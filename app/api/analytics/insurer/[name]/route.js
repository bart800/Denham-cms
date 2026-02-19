import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { name } = await params;
  const insurerName = decodeURIComponent(name);
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  // Get all cases for this insurer
  const { data: cases, error } = await supabaseAdmin
    .from("cases")
    .select("id, client_name, ref, status, insurer, jurisdiction, case_type, date_of_loss, created_at")
    .ilike("insurer", `%${insurerName}%`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cases || cases.length === 0) return NextResponse.json({ insurer: insurerName, cases: [], stats: {} });

  const caseIds = cases.map(c => c.id);

  // Fetch negotiations and estimates for these cases
  const [negRes, estRes, claimRes] = await Promise.all([
    supabaseAdmin.from("negotiations").select("*").in("case_id", caseIds),
    supabaseAdmin.from("estimates").select("*").in("case_id", caseIds),
    supabaseAdmin.from("claim_details").select("*").in("case_id", caseIds),
  ]);

  const negotiations = negRes.data || [];
  const estimates = estRes.data || [];
  const claims = claimRes.data || [];

  // Compute stats
  const totalCases = cases.length;
  const settled = cases.filter(c => c.status === "Settled");
  const denied = claims.filter(c => c.claim_status === "Denied" || c.denial_reason);
  const denialRate = totalCases > 0 ? denied.length / totalCases : 0;

  // Avg recovery
  const offers = negotiations.filter(n => n.type === "offer" && n.amount > 0);
  const totalRecovery = offers.reduce((s, n) => s + parseFloat(n.amount || 0), 0);
  const avgRecovery = offers.length > 0 ? totalRecovery / offers.length : 0;

  // Avg time to settle (days from case creation to settlement)
  const settleTimes = settled.map(c => {
    const created = new Date(c.created_at);
    // Approximate — use latest negotiation date as settlement date
    const caseNegs = negotiations.filter(n => n.case_id === c.id);
    if (caseNegs.length === 0) return null;
    const lastNeg = new Date(caseNegs.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date);
    return Math.round((lastNeg - created) / 86400000);
  }).filter(Boolean);
  const avgTimeToSettle = settleTimes.length > 0 ? Math.round(settleTimes.reduce((s, t) => s + t, 0) / settleTimes.length) : null;

  // Denial reasons
  const denialReasons = {};
  denied.forEach(d => {
    const reason = d.denial_reason || "Unspecified";
    denialReasons[reason] = (denialReasons[reason] || 0) + 1;
  });

  // Adjusters
  const adjusters = {};
  claims.forEach(c => {
    if (c.adjuster_name) {
      if (!adjusters[c.adjuster_name]) adjusters[c.adjuster_name] = { name: c.adjuster_name, cases: 0, phone: c.adjuster_phone, email: c.adjuster_email };
      adjusters[c.adjuster_name].cases++;
    }
  });

  // Case outcomes breakdown
  const outcomes = {};
  cases.forEach(c => {
    outcomes[c.status] = (outcomes[c.status] || 0) + 1;
  });

  // By jurisdiction
  const byJurisdiction = {};
  cases.forEach(c => {
    const j = c.jurisdiction || "Unknown";
    byJurisdiction[j] = (byJurisdiction[j] || 0) + 1;
  });

  return NextResponse.json({
    insurer: insurerName,
    stats: {
      totalCases,
      settledCount: settled.length,
      denialRate,
      deniedCount: denied.length,
      avgRecovery,
      totalRecovery,
      avgTimeToSettle,
      denialReasons,
      adjusters: Object.values(adjusters),
      outcomes,
      byJurisdiction,
    },
    cases: cases.map(c => ({
      ...c,
      negotiations: negotiations.filter(n => n.case_id === c.id),
      estimates: estimates.filter(e => e.case_id === c.id),
    })),
  });
}
