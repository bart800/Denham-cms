import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  // Get all litigation details with case info
  const { data: litData, error: litErr } = await db
    .from("litigation_details")
    .select("*, cases!inner(id, ref, client_name, status, insurer, total_recovery, jurisdiction, date_of_loss, date_opened)");

  if (litErr) return NextResponse.json({ error: litErr.message }, { status: 500 });

  const rows = litData || [];

  // Group by opposing counsel
  const counselMap = {};
  const judgeMap = {};

  for (const row of rows) {
    const c = row.cases;
    if (!c) continue;

    // Counsel aggregation
    const name = row.opposing_counsel?.trim();
    if (name) {
      if (!counselMap[name]) {
        counselMap[name] = {
          name,
          firm: row.opposing_firm || null,
          phone: row.opposing_phone || null,
          email: row.opposing_email || null,
          cases: [],
          insurers: new Set(),
          jurisdictions: new Set(),
        };
      }
      const entry = counselMap[name];
      entry.cases.push({
        id: c.id, ref: c.ref, client: c.client_name,
        status: c.status, insurer: c.insurer,
        recovery: Number(c.total_recovery) || 0,
        jurisdiction: c.jurisdiction,
      });
      if (c.insurer) entry.insurers.add(c.insurer);
      if (c.jurisdiction) entry.jurisdictions.add(c.jurisdiction);
    }

    // Judge aggregation
    const judge = row.judge?.trim();
    if (judge) {
      if (!judgeMap[judge]) {
        judgeMap[judge] = { name: judge, court: row.court, cases: [], outcomes: { settled: 0, active: 0, other: 0 } };
      }
      judgeMap[judge].cases.push({ id: c.id, ref: c.ref, client: c.client_name, status: c.status, recovery: Number(c.total_recovery) || 0 });
      if (c.status === "Settled") judgeMap[judge].outcomes.settled++;
      else if (["Closed"].includes(c.status)) judgeMap[judge].outcomes.other++;
      else judgeMap[judge].outcomes.active++;
    }
  }

  // Compute stats for each counsel
  const counsel = Object.values(counselMap).map((entry) => {
    const total = entry.cases.length;
    const settled = entry.cases.filter((c) => c.status === "Settled");
    const withRecovery = entry.cases.filter((c) => c.recovery > 0);
    const totalRecovery = entry.cases.reduce((sum, c) => sum + c.recovery, 0);

    return {
      name: entry.name,
      firm: entry.firm,
      phone: entry.phone,
      email: entry.email,
      totalCases: total,
      casesWon: withRecovery.length,
      winRate: total > 0 ? Math.round((withRecovery.length / total) * 1000) / 10 : 0,
      totalRecovery,
      avgRecovery: withRecovery.length > 0 ? Math.round(totalRecovery / withRecovery.length) : 0,
      insurers: [...entry.insurers],
      jurisdictions: [...entry.jurisdictions],
      cases: entry.cases,
    };
  }).sort((a, b) => b.totalCases - a.totalCases);

  const judges = Object.values(judgeMap)
    .map((j) => ({ ...j, totalCases: j.cases.length }))
    .sort((a, b) => b.totalCases - a.totalCases);

  return NextResponse.json({
    counsel,
    judges,
    summary: {
      totalAttorneys: counsel.length,
      totalFirms: new Set(counsel.map((c) => c.firm).filter(Boolean)).size,
      totalLitigationCases: rows.length,
      totalJudges: judges.length,
    },
  });
}
