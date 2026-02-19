import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    // Fetch cases
    const { data: cases, error: cErr } = await db
      .from("cases")
      .select("id, insurer, status, date_of_loss, date_opened, total_recovery");
    if (cErr) throw cErr;

    // Fetch claim_details for denial info
    const { data: claims, error: clErr } = await db
      .from("claim_details")
      .select("case_id, date_denied, insurer");
    if (clErr) throw clErr;

    // Index claims by case_id
    const claimMap = {};
    for (const cl of claims || []) {
      claimMap[cl.case_id] = cl;
    }

    // Group by insurer
    const insurerMap = {};
    for (const c of cases || []) {
      const ins = c.insurer || "Unknown";
      if (!insurerMap[ins]) {
        insurerMap[ins] = { insurer: ins, cases: [], denied: 0 };
      }
      const claim = claimMap[c.id];
      const hasDenial = claim?.date_denied ? true : false;
      insurerMap[ins].cases.push({ ...c, hasDenial });
      if (hasDenial) insurerMap[ins].denied++;
    }

    const results = Object.values(insurerMap).map((g) => {
      const total = g.cases.length;
      const byStatus = {};
      let settledCount = 0;
      let closedZeroCount = 0;
      let totalRecovery = 0;
      let settleDays = [];

      for (const c of g.cases) {
        const st = (c.status || "Unknown").toLowerCase();
        byStatus[c.status || "Unknown"] = (byStatus[c.status || "Unknown"] || 0) + 1;
        const rec = Number(c.total_recovery) || 0;
        totalRecovery += rec;

        if (st === "settled" || st.includes("settled")) {
          settledCount++;
          if (c.date_of_loss && c.date_opened) {
            // Use date_opened as proxy for settlement date if no explicit field
            const dol = new Date(c.date_of_loss);
            const settled = new Date(c.date_opened);
            const days = Math.round((settled - dol) / 86400000);
            if (days > 0) settleDays.push(days);
          }
        }
        if ((st === "closed" || st.includes("closed")) && rec === 0) {
          closedZeroCount++;
        }
      }

      const denialRate = total > 0 ? g.denied / total : 0;
      const avgDaysToSettle = settleDays.length > 0
        ? Math.round(settleDays.reduce((a, b) => a + b, 0) / settleDays.length)
        : null;
      const avgRecovery = total > 0 ? totalRecovery / total : 0;
      const winDenom = settledCount + closedZeroCount;
      const winRate = winDenom > 0 ? settledCount / winDenom : null;

      return {
        insurer: g.insurer,
        totalCases: total,
        byStatus,
        denialRate,
        avgDaysToSettle,
        totalRecovery,
        avgRecovery,
        winRate,
        settledCount,
        closedZeroCount,
        deniedCount: g.denied,
      };
    });

    results.sort((a, b) => b.totalCases - a.totalCases);

    // Summary
    const totalInsurers = results.length;
    const totalCases = results.reduce((s, r) => s + r.totalCases, 0);
    const totalRec = results.reduce((s, r) => s + r.totalRecovery, 0);
    const avgRecovery = totalCases > 0 ? totalRec / totalCases : 0;
    const totalDenied = results.reduce((s, r) => s + r.deniedCount, 0);
    const overallDenialRate = totalCases > 0 ? totalDenied / totalCases : 0;

    return NextResponse.json({
      summary: { totalInsurers, totalCases, avgRecovery, overallDenialRate, totalRecovery: totalRec },
      insurers: results,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
