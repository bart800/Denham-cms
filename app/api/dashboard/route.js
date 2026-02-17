import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    // Fetch all cases (select only needed columns)
    const { data: cases, error: casesErr } = await supabaseAdmin
      .from("cases")
      .select("id, client_name, status, case_type, jurisdiction, insurance_company, sol_date, date_opened, recovery_amount, fee_amount, attorney_id");

    if (casesErr) throw casesErr;

    // Fetch team members for attorney lookup
    const { data: teamMembers } = await supabaseAdmin
      .from("team_members")
      .select("id, name");

    const attorneyMap = {};
    (teamMembers || []).forEach((m) => { attorneyMap[m.id] = m.name; });

    // Fetch recent activity
    const { data: activity } = await supabaseAdmin
      .from("activity_log")
      .select("*, case:cases!activity_log_case_id_fkey(client_name)")
      .order("created_at", { ascending: false })
      .limit(10);

    // Compute stats
    const total_cases = cases.length;

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

    for (const c of cases) {
      // Status
      const s = c.status || "unknown";
      cases_by_status[s] = (cases_by_status[s] || 0) + 1;

      // Type
      const t = c.case_type || "unknown";
      cases_by_type[t] = (cases_by_type[t] || 0) + 1;

      // Jurisdiction
      const j = c.jurisdiction || "unknown";
      cases_by_jurisdiction[j] = (cases_by_jurisdiction[j] || 0) + 1;

      // Insurer
      if (c.insurance_company) {
        insurerCount[c.insurance_company] = (insurerCount[c.insurance_company] || 0) + 1;
      }

      // Attorney
      if (c.attorney_id && attorneyMap[c.attorney_id]) {
        const name = attorneyMap[c.attorney_id];
        attorneyCount[name] = (attorneyCount[name] || 0) + 1;
      }

      // Financials
      total_recovery_sum += Number(c.recovery_amount) || 0;
      total_fees_sum += Number(c.fee_amount) || 0;

      // Date opened
      if (c.date_opened) {
        if (c.date_opened >= monthStart) cases_opened_this_month++;
        if (c.date_opened >= yearStart) cases_opened_this_year++;
      }

      // SOL
      if (c.sol_date) {
        if (c.sol_date < today) {
          sol_expired_count++;
        } else if (c.sol_date <= in30) {
          const days_remaining = Math.ceil((new Date(c.sol_date) - now) / 86400000);
          sol_urgent_list.push({
            id: c.id,
            client_name: c.client_name,
            sol_date: c.sol_date,
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
    const recent_activity = (activity || []).map((a) => ({
      ...a,
      case_name: a.case?.client_name || null,
      case: undefined,
    }));

    return NextResponse.json({
      total_cases,
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
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
