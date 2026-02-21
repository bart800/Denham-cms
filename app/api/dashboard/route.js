import { supabaseAdmin } from "@/lib/supabase";
import { hasPermission } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterAttorneyId = searchParams.get("attorney_id") || null;
    const memberRole = searchParams.get("role") || null;
    const canViewFinancials = hasPermission(memberRole, "viewFinancials");
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    // Fetch all cases (select only needed columns)
    const { data: cases, error: casesErr } = await supabaseAdmin
      .from("cases")
      .select("id, client_name, status, type, jurisdiction, insurer, statute_of_limitations, date_opened, total_recovery, attorney_fees, attorney_id, updated_at, settlement_amount");

    if (casesErr) throw casesErr;

    // Fetch team members for attorney lookup
    const { data: teamMembers } = await supabaseAdmin
      .from("team_members")
      .select("id, name");

    const attorneyMap = {};
    (teamMembers || []).forEach((m) => { attorneyMap[m.id] = m.name; });

    // Fetch recent activity (gracefully handle empty or missing FK)
    let activity = [];
    try {
      const { data: actData } = await supabaseAdmin
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      activity = actData || [];
    } catch { /* empty or table issue */ }

    // Filter by attorney if requested
    const scopedCases = filterAttorneyId ? cases.filter(c => c.attorney_id === filterAttorneyId) : cases;

    // Separate closed/referred cases
    const activeCases = scopedCases.filter(c => c.status !== "Closed" && c.status !== "Referred");
    const closed_count = scopedCases.filter(c => c.status === "Closed").length;
    const referred_count = scopedCases.filter(c => c.status === "Referred").length;

    // Compute stats
    const total_cases = activeCases.length;

    const cases_by_status = {};
    const cases_by_type = {};
    const cases_by_jurisdiction = {};
    const insurerCount = {};
    const attorneyCount = {};
    let total_recovery_sum = 0;
    let total_fees_sum = 0;
    let cases_opened_this_month = 0;
    let cases_opened_this_year = 0;
    const sol_urgent_list = [];
    let sol_expired_count = 0;

    for (const c of activeCases) {
      // Status
      const s = c.status || "unknown";
      cases_by_status[s] = (cases_by_status[s] || 0) + 1;

      // Type
      const t = c.type || "unknown";
      cases_by_type[t] = (cases_by_type[t] || 0) + 1;

      // Jurisdiction
      const j = c.jurisdiction || "unknown";
      cases_by_jurisdiction[j] = (cases_by_jurisdiction[j] || 0) + 1;

      // Insurer
      if (c.insurer) {
        insurerCount[c.insurer] = (insurerCount[c.insurer] || 0) + 1;
      }

      // Attorney
      if (c.attorney_id && attorneyMap[c.attorney_id]) {
        const name = attorneyMap[c.attorney_id];
        attorneyCount[name] = (attorneyCount[name] || 0) + 1;
      }

      // Financials — only settled cases with payments after Jan 1 2026
      if (c.status === "Settled" && c.updated_at && c.updated_at >= "2026-01-01") {
        total_recovery_sum += Number(c.total_recovery) || 0;
        total_fees_sum += Number(c.attorney_fees) || 0;
      }

      // Date opened
      if (c.date_opened) {
        if (c.date_opened >= monthStart) cases_opened_this_month++;
        if (c.date_opened >= yearStart) cases_opened_this_year++;
      }

      // SOL
      if (c.statute_of_limitations) {
        if (c.statute_of_limitations < today) {
          sol_expired_count++;
        } else if (c.statute_of_limitations <= in30) {
          const days_remaining = Math.ceil((new Date(c.statute_of_limitations) - now) / 86400000);
          sol_urgent_list.push({
            id: c.id,
            client_name: c.client_name,
            sol_date: c.statute_of_limitations,
            days_remaining,
          });
        }
      }
    }

    // Top insurers
    const top_insurers = Object.entries(insurerCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Cases by attorney
    const cases_by_attorney = Object.entries(attorneyCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // SOL urgent sorted
    sol_urgent_list.sort((a, b) => a.days_remaining - b.days_remaining);

    // Recent activity
    const recent_activity = activity;

    // Attorney list for picker (only those with cases)
    const attorneys = (teamMembers || [])
      .filter(m => cases.some(c => c.attorney_id === m.id))
      .map(m => ({ id: m.id, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Data quality metrics
    const missing_sol = activeCases.filter(c => !c.statute_of_limitations).length;
    const missing_insurer = activeCases.filter(c => !c.insurer).length;

    // Workflow stats: tasks due today, overdue, phase bottlenecks
    let tasks_due_today = 0, tasks_overdue = 0, phase_bottlenecks = [];
    try {
      const activeIds = activeCases.map(c => c.id);
      if (activeIds.length > 0) {
        const [dueTodayRes, overdueRes, allTasksRes] = await Promise.all([
          supabaseAdmin.from('case_tasks').select('id', { count: 'exact', head: true })
            .in('case_id', activeIds).eq('due_date', today).neq('status', 'completed'),
          supabaseAdmin.from('case_tasks').select('id', { count: 'exact', head: true })
            .in('case_id', activeIds).lt('due_date', today).neq('status', 'completed'),
          supabaseAdmin.from('case_tasks').select('case_id, phase, status, created_at')
            .in('case_id', activeIds).neq('status', 'completed'),
        ]);
        tasks_due_today = dueTodayRes.count || 0;
        tasks_overdue = overdueRes.count || 0;

        // Phase bottleneck: group pending tasks by phase, count cases & avg age
        const phaseMap = {};
        for (const t of (allTasksRes.data || [])) {
          const p = t.phase || 'Unknown';
          if (!phaseMap[p]) phaseMap[p] = { phase: p, case_ids: new Set(), total_age_days: 0, task_count: 0 };
          phaseMap[p].case_ids.add(t.case_id);
          phaseMap[p].task_count++;
          const age = Math.floor((now - new Date(t.created_at)) / 86400000);
          phaseMap[p].total_age_days += age;
        }
        phase_bottlenecks = Object.values(phaseMap)
          .map(p => ({ phase: p.phase, cases: p.case_ids.size, pending_tasks: p.task_count, avg_age_days: Math.round(p.total_age_days / p.task_count) }))
          .sort((a, b) => b.cases - a.cases);
      }
    } catch { /* workflow stats optional */ }

    // Communication stats (counts only, fast)
    let email_count = 0, call_count = 0, linked_calls = 0, doc_count = 0, linked_docs = 0;
    try {
      const [emailRes, callRes, linkedCallRes, docRes, linkedDocRes] = await Promise.all([
        supabaseAdmin.from("case_emails").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("case_calls").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("case_calls").select("id", { count: "exact", head: true }).not("case_id", "is", null),
        supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("documents").select("id", { count: "exact", head: true }).not("case_id", "is", null),
      ]);
      email_count = emailRes.count || 0;
      call_count = callRes.count || 0;
      linked_calls = linkedCallRes.count || 0;
      doc_count = docRes.count || 0;
      linked_docs = linkedDocRes.count || 0;
    } catch { /* counts optional */ }

    const response = {
      total_cases,
      attorneys,
      closed_count,
      referred_count,
      cases_by_status,
      cases_by_type,
      cases_by_jurisdiction,
      top_insurers,
      sol_urgent: { count: sol_urgent_list.length, list: sol_urgent_list },
      sol_expired: { count: sol_expired_count },
      cases_opened_this_month,
      cases_opened_this_year,
      cases_by_attorney,
      recent_activity,
      data_quality: { missing_sol, missing_insurer },
      workflow: { tasks_due_today, tasks_overdue, phase_bottlenecks },
      comms: { email_count, call_count, linked_calls, doc_count, linked_docs },
    };

    // Only include financial data for roles with permission
    if (canViewFinancials) {
      response.total_recovery_sum = total_recovery_sum;
      response.total_fees_sum = total_fees_sum;
    } else {
      response.total_recovery_sum = null;
      response.total_fees_sum = null;
      response._financials_hidden = true;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
