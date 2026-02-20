import { supabaseAdmin, supabase as supabaseAnon } from "../../../../lib/supabase";

const supabase = supabaseAdmin || supabaseAnon;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("caseId");
  if (!caseId) return Response.json({ error: "caseId required" }, { status: 400 });

  try {
    // Fetch case with all related data
    const { data: c, error } = await supabase
      .from("cases")
      .select(`
        *, attorney:team_members!cases_attorney_id_fkey(name),
        support:team_members!cases_support_id_fkey(name),
        claim_details(*), litigation_details(*),
        negotiations(*), estimates(*), pleadings(*),
        tasks(*), documents(id, doc_type, ai_metadata, ai_summary)
      `)
      .eq("id", caseId)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Fetch similar cases for benchmarking (same insurer or same type)
    const { data: similar } = await supabase
      .from("cases")
      .select("id, ref, client_name, insurer, type, status, total_recovery, date_of_loss, jurisdiction, cause_of_loss")
      .or(`insurer.eq.${c.insurer || "NONE"},type.eq.${c.type || "NONE"}`)
      .neq("id", caseId)
      .not("status", "in", '("Closed")')
      .limit(100);

    const strategy = buildStrategy(c, similar || []);
    return Response.json({ strategy, caseRef: c.ref, client: c.client_name });
  } catch (err) {
    console.error("Strategy API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function buildStrategy(c, similar) {
  const now = new Date();
  const cd = c.claim_details?.[0] || {};
  const lit = c.litigation_details?.[0] || {};
  const negs = c.negotiations || [];
  const ests = c.estimates || [];
  const tasks = c.tasks || [];
  const pleadings = c.pleadings || [];

  // ─── SOL Analysis ───────────────────────────────────
  const sol = c.statute_of_limitations ? new Date(c.statute_of_limitations + "T00:00:00") : null;
  const solDays = sol ? Math.ceil((sol - now) / 86400000) : null;

  // ─── Negotiation Analysis ───────────────────────────
  const demands = negs.filter(n => n.type === "plaintiff_offer" || n.type === "presuit_demand").sort((a, b) => new Date(b.date) - new Date(a.date));
  const offers = negs.filter(n => n.type === "defendant_offer").sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastDemand = demands[0];
  const lastOffer = offers[0];
  const demandAmount = lastDemand ? Number(lastDemand.amount) : 0;
  const offerAmount = lastOffer ? Number(lastOffer.amount) : 0;
  const gap = demandAmount && offerAmount ? ((demandAmount - offerAmount) / demandAmount * 100).toFixed(0) : null;

  // ─── Estimate Analysis ──────────────────────────────
  const totalEstimate = ests.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const highestEstimate = ests.reduce((max, e) => Math.max(max, Number(e.amount) || 0), 0);

  // ─── Similar Case Benchmarks ────────────────────────
  const sameInsurer = similar.filter(s => s.insurer === c.insurer);
  const sameType = similar.filter(s => s.type === c.type);
  const settledSameInsurer = sameInsurer.filter(s => s.status === "Settled" && s.total_recovery > 0);
  const settledSameType = sameType.filter(s => s.status === "Settled" && s.total_recovery > 0);
  const avgRecoverySameInsurer = settledSameInsurer.length > 0
    ? settledSameInsurer.reduce((s, c) => s + Number(c.total_recovery), 0) / settledSameInsurer.length : null;
  const avgRecoverySameType = settledSameType.length > 0
    ? settledSameType.reduce((s, c) => s + Number(c.total_recovery), 0) / settledSameType.length : null;
  const insurerDenialRate = sameInsurer.length > 0
    ? (sameInsurer.filter(s => s.status === "Denied" || s.cause_of_loss?.includes("Denial")).length / sameInsurer.length * 100).toFixed(0) : null;

  // ─── Task Completion ────────────────────────────────
  const completedTasks = tasks.filter(t => t.completed || t.status === "completed").length;
  const overdueTasks = tasks.filter(t => !t.completed && t.status !== "completed" && t.due_date && new Date(t.due_date) < now).length;

  // ─── Build Risk Assessment ──────────────────────────
  const risks = [];

  if (solDays !== null && solDays < 0) {
    risks.push({ severity: "critical", category: "SOL", message: `Statute of limitations EXPIRED ${Math.abs(solDays)} days ago`, action: "Evaluate if any tolling arguments or saving doctrines apply" });
  } else if (solDays !== null && solDays < 30) {
    risks.push({ severity: "critical", category: "SOL", message: `Only ${solDays} days until SOL expires`, action: "File suit immediately or obtain tolling agreement" });
  } else if (solDays !== null && solDays < 90) {
    risks.push({ severity: "warning", category: "SOL", message: `${solDays} days until SOL — approaching deadline`, action: "Prepare complaint for filing if presuit resolution unlikely" });
  }

  if (overdueTasks > 0) {
    risks.push({ severity: "warning", category: "Tasks", message: `${overdueTasks} overdue task${overdueTasks > 1 ? "s" : ""}`, action: "Review and complete overdue items" });
  }

  const lastActivity = getLastActivityDate(c);
  const daysSinceActivity = lastActivity ? Math.ceil((now - new Date(lastActivity)) / 86400000) : null;
  if (daysSinceActivity && daysSinceActivity > 60) {
    risks.push({ severity: daysSinceActivity > 120 ? "critical" : "warning", category: "Stale", message: `No activity in ${daysSinceActivity} days`, action: "Review case status and contact client" });
  }

  if (c.status === "Presuit" && daysSinceActivity > 14) {
    risks.push({ severity: "warning", category: "Presuit", message: "Case stuck in intake for 2+ weeks", action: "Complete intake and move to investigation" });
  }

  if (gap && Number(gap) > 80) {
    risks.push({ severity: "info", category: "Negotiation", message: `Large gap between demand and offer (${gap}%)`, action: "Consider whether litigation pressure is needed to close the gap" });
  }

  // ─── Strategic Recommendations ──────────────────────
  const recommendations = [];

  // Phase-based recommendations
  if (c.status === "Presuit") {
    recommendations.push({ priority: "high", category: "Process", title: "Complete Intake", detail: "Gather all policy documents, loss documentation, and client statements. Verify coverage and confirm statute of limitations." });
  }

  if (c.status === "Presuit") {
    recommendations.push({ priority: "high", category: "Process", title: "Complete Investigation", detail: "Obtain independent estimates, document all damages, review policy language for coverage arguments." });
    if (ests.length === 0) {
      recommendations.push({ priority: "high", category: "Evidence", title: "Obtain Damage Estimates", detail: "No estimates on file. Get at least one independent contractor estimate and consider a public adjuster inspection." });
    }
  }

  if (c.status === "Presuit") {
    recommendations.push({ priority: "medium", category: "Negotiation", title: "Track Demand Response", detail: `Demand sent. Monitor for insurer response within statutory timeframe.${demandAmount ? ` Demand amount: $${demandAmount.toLocaleString()}` : ""}` });
    if (solDays && solDays < 180) {
      recommendations.push({ priority: "high", category: "Litigation", title: "Prepare Complaint", detail: "SOL approaching — prepare complaint for filing in case presuit resolution fails." });
    }
  }

  if (c.status === "Presuit") {
    if (lastOffer && lastDemand) {
      const ratio = offerAmount / demandAmount;
      if (ratio < 0.3) {
        recommendations.push({ priority: "high", category: "Litigation", title: "Consider Filing Suit", detail: `Insurer's offer ($${offerAmount.toLocaleString()}) is only ${(ratio * 100).toFixed(0)}% of demand. Litigation may be needed to move the needle.` });
      } else if (ratio >= 0.3 && ratio < 0.7) {
        recommendations.push({ priority: "medium", category: "Negotiation", title: "Continue Negotiating", detail: `Offer at ${(ratio * 100).toFixed(0)}% of demand. Room to negotiate — consider counter-offer or mediation.` });
      } else {
        recommendations.push({ priority: "medium", category: "Settlement", title: "Evaluate Settlement", detail: `Offer at ${(ratio * 100).toFixed(0)}% of demand. Close to resolution — evaluate whether to accept or push for more.` });
      }
    }
    if (!lastOffer && demands.length > 0) {
      recommendations.push({ priority: "medium", category: "Negotiation", title: "Follow Up on Demand", detail: "Demand sent but no offer received. Follow up with adjuster." });
    }
  }

  if (c.status?.startsWith("Litigation")) {
    if (pleadings.length === 0) {
      recommendations.push({ priority: "high", category: "Litigation", title: "File Initial Pleadings", detail: "Case in litigation but no pleadings on file." });
    }
    recommendations.push({ priority: "medium", category: "Discovery", title: "Review Discovery Deadlines", detail: "Check discovery schedule and ensure all responses are timely." });
    if (negs.length > 0) {
      recommendations.push({ priority: "low", category: "Settlement", title: "Evaluate Settlement Posture", detail: "Review latest negotiation positions and assess whether mediation could resolve the case." });
    }
  }

  if (c.status === "Appraisal") {
    recommendations.push({ priority: "medium", category: "Process", title: "Monitor Appraisal Process", detail: "Ensure appraiser is appointed and umpire selection process is on track." });
  }

  // Claim-specific recommendations
  if (cd.claim_status === "Denied" || cd.date_denied) {
    recommendations.push({ priority: "high", category: "Strategy", title: "Challenge Denial", detail: `Claim was denied${cd.date_denied ? ` on ${cd.date_denied}` : ""}. Review denial letter for bad faith indicators. Consider appraisal demand or extracontractual claims.` });
  }

  // Evidence strength
  const docCount = c.documents?.length || 0;
  const analyzedDocs = c.documents?.filter(d => d.ai_summary || d.ai_metadata).length || 0;
  if (docCount > 0 && analyzedDocs === 0) {
    recommendations.push({ priority: "low", category: "Evidence", title: "Run AI Document Analysis", detail: `${docCount} documents on file but none analyzed. Run the doc analyzer to extract key data points.` });
  }

  // ─── Case Strength Score ────────────────────────────
  let strength = 50; // baseline
  if (ests.length > 0) strength += 10;
  if (highestEstimate > 50000) strength += 5;
  if (docCount > 10) strength += 5;
  if (cd.claim_status === "Denied") strength += 10; // denial = bad faith potential
  if (negs.length > 0) strength += 5;
  if (c.status?.startsWith("Litigation")) strength += 5;
  if (solDays !== null && solDays < 30) strength -= 15;
  if (daysSinceActivity > 90) strength -= 10;
  if (overdueTasks > 3) strength -= 5;
  strength = Math.max(10, Math.min(95, strength));

  // ─── Settlement Range Estimate ──────────────────────
  let settlementRange = null;
  if (highestEstimate > 0) {
    const low = Math.round(highestEstimate * 0.6);
    const mid = Math.round(highestEstimate * 0.85);
    const high = Math.round(highestEstimate * 1.1);
    settlementRange = { low, mid, high };
  }

  return {
    caseStatus: c.status,
    caseType: c.type,
    insurer: c.insurer,
    jurisdiction: c.jurisdiction,
    solDays,
    daysSinceActivity,
    strengthScore: strength,
    risks,
    recommendations: recommendations.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
    }),
    negotiationSummary: {
      totalRounds: negs.length,
      lastDemand: lastDemand ? { amount: demandAmount, date: lastDemand.date } : null,
      lastOffer: lastOffer ? { amount: offerAmount, date: lastOffer.date } : null,
      gapPercent: gap ? Number(gap) : null,
    },
    estimateSummary: {
      count: ests.length,
      total: totalEstimate,
      highest: highestEstimate,
    },
    settlementRange,
    benchmarks: {
      sameInsurer: {
        totalCases: sameInsurer.length,
        settledCount: settledSameInsurer.length,
        avgRecovery: avgRecoverySameInsurer,
        denialRate: insurerDenialRate ? Number(insurerDenialRate) : null,
      },
      sameType: {
        totalCases: sameType.length,
        settledCount: settledSameType.length,
        avgRecovery: avgRecoverySameType,
      },
    },
    taskSummary: {
      total: tasks.length,
      completed: completedTasks,
      overdue: overdueTasks,
    },
  };
}

function getLastActivityDate(c) {
  const dates = [];
  for (const n of c.negotiations || []) if (n.date) dates.push(n.date);
  for (const e of c.estimates || []) if (e.date) dates.push(e.date);
  for (const p of c.pleadings || []) if (p.date_filed || p.date) dates.push(p.date_filed || p.date);
  if (dates.length === 0) return null;
  return dates.sort().pop();
}

