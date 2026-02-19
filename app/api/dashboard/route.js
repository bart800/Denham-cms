import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterAttorneyId = searchParams.get("attorney_id") || null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    // Fetch all cases (select only needed columns)
    const { data: cases, error: casesErr } = await supabaseAdmin
      .from("cases")
      .select("id, client_name, status, type, jurisdiction, insurer, statute_of_limitations, date_opened, total_recovery, attorney_fees, attorney_id");

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

      // Financials
      total_recovery_sum += Number(c.total_recovery) || 0;
      total_fees_sum += Number(c.attorney_fees) || 0;

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

    return NextResponse.json({
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
      total_recovery_sum,
      total_fees_sum,
      cases_by_attorney,
      recent_activity,
      data_quality: { missing_sol, missing_insurer },
      comms: { email_count, call_count, linked_calls, doc_count, linked_docs },
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
