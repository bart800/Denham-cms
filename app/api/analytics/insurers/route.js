import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const causeFilter = searchParams.get("cause_of_loss");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    // Fetch cases
    const { data: cases, error: casesErr } = await supabaseAdmin
      .from("cases")
      .select("id, case_number, client_name, status, date_opened");
    if (casesErr) throw casesErr;

    // Fetch claim_details
    const { data: claims, error: claimsErr } = await supabaseAdmin
      .from("claim_details")
      .select("case_id, insurer, date_of_loss, date_denied, cause_of_loss, policy_limits, estimate_total, claim_status, phase");
    if (claimsErr) throw claimsErr;

    // Fetch negotiations (estimates)
    const { data: negotiations, error: negErr } = await supabaseAdmin
      .from("negotiations")
      .select("case_id, type, amount");
    if (negErr) throw negErr;

    // Build lookup maps
    const caseMap = {};
    for (const c of cases) caseMap[c.id] = c;

    const estimatesByCaseId = {};
    for (const n of negotiations) {
      if (n.type === "estimate" && n.amount) {
        estimatesByCaseId[n.case_id] = (estimatesByCaseId[n.case_id] || 0) + Number(n.amount);
      }
    }

    // Group claims by insurer, applying filters
    const insurerData = {};

    for (const cl of claims) {
      if (!cl.insurer) continue;

      const parentCase = caseMap[cl.case_id];
      if (!parentCase) continue;

      // Apply filters
      if (statusFilter && parentCase.status !== statusFilter) continue;
      if (causeFilter && cl.cause_of_loss !== causeFilter) continue;
      if (dateFrom && cl.date_of_loss && cl.date_of_loss < dateFrom) continue;
      if (dateTo && cl.date_of_loss && cl.date_of_loss > dateTo) continue;

      const name = cl.insurer.trim();
      if (!insurerData[name]) {
        insurerData[name] = {
          insurer: name,
          total_cases: 0,
          denied_count: 0,
          denial_days_sum: 0,
          denial_days_count: 0,
          statuses: {},
          causes: {},
          estimate_total: 0,
          duration_days_sum: 0,
          duration_days_count: 0,
        };
      }

      const d = insurerData[name];
      d.total_cases++;

      // Denial tracking
      if (cl.date_denied) {
        d.denied_count++;
        if (cl.date_of_loss) {
          const days = Math.round((new Date(cl.date_denied) - new Date(cl.date_of_loss)) / 86400000);
          if (days > 0) {
            d.denial_days_sum += days;
            d.denial_days_count++;
          }
        }
      }

      // Status breakdown
      const st = parentCase.status || "unknown";
      d.statuses[st] = (d.statuses[st] || 0) + 1;

      // Cause of loss breakdown
      if (cl.cause_of_loss) {
        d.causes[cl.cause_of_loss] = (d.causes[cl.cause_of_loss] || 0) + 1;
      }

      // Estimates
      d.estimate_total += Number(cl.estimate_total || 0) + (estimatesByCaseId[cl.case_id] || 0);

      // Case duration (date_opened to now or closed)
      if (parentCase.date_opened) {
        const end = parentCase.status === "Closed" ? new Date() : new Date(); // Use now for all
        const dur = Math.round((end - new Date(parentCase.date_opened)) / 86400000);
        if (dur > 0) {
          d.duration_days_sum += dur;
          d.duration_days_count++;
        }
      }
    }

    // Compute final stats
    const insurers = Object.values(insurerData).map((d) => ({
      insurer: d.insurer,
      total_cases: d.total_cases,
      denial_rate: d.total_cases > 0 ? Math.round((d.denied_count / d.total_cases) * 1000) / 10 : 0,
      denied_count: d.denied_count,
      avg_days_to_denial: d.denial_days_count > 0 ? Math.round(d.denial_days_sum / d.denial_days_count) : null,
      statuses: d.statuses,
      causes: d.causes,
      estimate_total: Math.round(d.estimate_total * 100) / 100,
      avg_case_duration_days: d.duration_days_count > 0 ? Math.round(d.duration_days_sum / d.duration_days_count) : null,
    })).sort((a, b) => b.total_cases - a.total_cases);

    // Summary stats
    const totalCases = insurers.reduce((s, i) => s + i.total_cases, 0);
    const totalDenied = insurers.reduce((s, i) => s + i.denied_count, 0);
    const avgDenialRate = totalCases > 0 ? Math.round((totalDenied / totalCases) * 1000) / 10 : 0;

    // Get all unique causes and statuses for filter options
    const allCauses = [...new Set(claims.map(c => c.cause_of_loss).filter(Boolean))].sort();
    const allStatuses = [...new Set(cases.map(c => c.status).filter(Boolean))].sort();

    return NextResponse.json({
      insurers,
      summary: {
        total_cases: totalCases,
        total_insurers: insurers.length,
        avg_denial_rate: avgDenialRate,
        top_insurer: insurers[0]?.insurer || "N/A",
        total_denied: totalDenied,
        total_estimates: Math.round(insurers.reduce((s, i) => s + i.estimate_total, 0) * 100) / 100,
      },
      filter_options: { causes: allCauses, statuses: allStatuses },
    });
  } catch (err) {
    console.error("Insurer analytics error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
