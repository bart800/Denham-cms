import { supabaseAdmin, supabase } from "@/lib/supabase";
import { hasPermission } from "@/lib/rbac";
import { NextResponse } from "next/server";
const db = supabaseAdmin || supabase;

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

function getWeekRange(weekStart) {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString(), startDate: weekStart, endDate: end.toISOString().split("T")[0] };
}

function weeksElapsedInYear(weekStart) {
  const jan1 = new Date(new Date(weekStart).getFullYear(), 0, 1);
  const ws = new Date(weekStart);
  return Math.max(1, Math.ceil((ws - jan1) / (7 * 24 * 60 * 60 * 1000)));
}

async function computeActuals(weekStart, memberId) {
  const { start, end } = getWeekRange(weekStart);
  const actuals = {};

  // Helper to count
  async function countCases(filter) {
    let q = db.from("cases").select("id", { count: "exact", head: true });
    q = filter(q);
    if (memberId) q = q.eq("assigned_attorney", memberId);
    const { count } = await q;
    return count || 0;
  }

  async function countTasks(titlePatterns, weekField = "completed_at") {
    let total = 0;
    for (const pattern of titlePatterns) {
      let q = db.from("case_tasks").select("id", { count: "exact", head: true })
        .ilike("title", `%${pattern}%`)
        .eq("status", "completed")
        .gte(weekField, start)
        .lt(weekField, end);
      if (memberId) q = q.eq("assigned_to", memberId);
      const { count } = await q;
      total += (count || 0);
    }
    return total;
  }

  async function getManual(metric) {
    let q = db.from("kpi_actuals").select("actual_value").eq("metric", metric).eq("week_start", weekStart);
    if (memberId) q = q.eq("member_id", memberId);
    else q = q.is("member_id", null);
    const { data } = await q;
    return data && data.length > 0 ? Number(data[0].actual_value) : 0;
  }

  // leads
  actuals.leads = await countCases(q => q.gte("created_at", start).lt("created_at", end));

  // cases_signed
  actuals.cases_signed = await countCases(q => q.gte("date_contract_signed", weekStart).lt("date_contract_signed", getWeekRange(weekStart).endDate));

  // presuit_demands_sent
  actuals.presuit_demands_sent = await countTasks(["Demand served"]);

  // settlement_offers
  actuals.settlement_offers = await countTasks(["Settlement offer", "settlement authority"]);

  // complaints_filed
  actuals.complaints_filed = await countTasks(["Complaint filed"]);

  // cases_settled
  actuals.cases_settled = await countCases(q => q.eq("status", "Settled").gte("updated_at", start).lt("updated_at", end));

  // discovery_served
  actuals.discovery_served = await countTasks(["discovery responses served"]);

  // discovery_drafted
  actuals.discovery_drafted = await countTasks(["Interrogatories answered", "Admissions answered", "Production of Documents answered"]);

  // complaints_drafted
  actuals.complaints_drafted = await countTasks(["Complaint drafted"]);

  // demands_drafted
  actuals.demands_drafted = await countTasks(["Demand letter drafted", "Demand drafted"]);

  // client_updates - emails + calls
  {
    let eq1 = db.from("case_emails").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end);
    const { count: emailCount } = await eq1;
    let eq2 = db.from("case_calls").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end);
    const { count: callCount } = await eq2;
    actuals.client_updates = (emailCount || 0) + (callCount || 0);
  }

  // Manual metrics
  actuals.referral_source_updates = await getManual("referral_source_updates");
  actuals.new_referral_interactions = await getManual("new_referral_interactions");
  actuals.undisputed_payments = await getManual("undisputed_payments");

  return actuals;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "admin";
    const memberId = searchParams.get("member_id") || null;
    const weeksBack = parseInt(searchParams.get("weeks") || "8");
    const specificWeek = searchParams.get("week");
    const memberRole = searchParams.get("role") || null;
    const canViewRevenue = hasPermission(memberRole, "viewRevenue");

    // Load targets
    const { data: targets } = await db.from("kpi_targets").select("*").is("assigned_to", null);

    // Determine weeks to compute
    const now = new Date();
    const currentWeek = specificWeek || getMonday(now);
    const weeks = [];
    for (let i = 0; i < weeksBack; i++) {
      const d = new Date(currentWeek);
      d.setDate(d.getDate() - i * 7);
      weeks.push(getMonday(d));
    }

    // Compute actuals for current week (and optionally previous for trend)
    const filterMember = view === "individual" ? memberId : null;
    const currentActuals = await computeActuals(currentWeek, filterMember);
    const prevWeek = getMonday(new Date(new Date(currentWeek).getTime() - 7 * 24 * 60 * 60 * 1000));
    const prevActuals = await computeActuals(prevWeek, filterMember);

    // Build response
    const weeksInYear = weeksElapsedInYear(currentWeek);
    const metrics = (targets || []).map(t => {
      const actual = currentActuals[t.metric] ?? 0;
      const prev = prevActuals[t.metric] ?? 0;
      const pct = t.weekly_target > 0 ? Math.round((actual / t.weekly_target) * 100) : 0;
      const trend = actual > prev ? "up" : actual < prev ? "down" : "flat";
      return {
        metric: t.metric,
        category: t.category,
        weekly_target: Number(t.weekly_target),
        actual,
        previous: prev,
        pct,
        trend,
        ytd_target: Number(t.weekly_target) * weeksInYear,
        ytd_actual: actual, // simplified - would need sum of all weeks for true YTD
      };
    });

    // Filter out revenue metrics for non-authorized roles
    const REVENUE_METRICS = ["undisputed_payments", "cases_settled", "settlement_offers"];
    const filteredMetrics = canViewRevenue
      ? metrics
      : metrics.filter(m => !REVENUE_METRICS.includes(m.metric));

    return NextResponse.json({
      week: currentWeek,
      prev_week: prevWeek,
      weeks_in_year: weeksInYear,
      view,
      metrics: filteredMetrics,
      targets: canViewRevenue ? (targets || []) : (targets || []).filter(t => !REVENUE_METRICS.includes(t.metric)),
      _revenue_hidden: !canViewRevenue,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
