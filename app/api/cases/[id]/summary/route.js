import { supabaseAdmin, supabase as supabaseAnon } from "../../../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabaseAnon;

export async function GET(request, { params }) {
  const { id } = await params;
  
  // Check cache first
  const { data: cached } = await db
    .from("case_summaries")
    .select("*")
    .eq("case_id", id)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at).getTime();
    const stale = age > 24 * 60 * 60 * 1000; // 24h
    return NextResponse.json({ summary: cached.summary_text, data: cached.summary_data, cached: true, stale, updated_at: cached.updated_at });
  }

  return NextResponse.json({ summary: null, cached: false });
}

export async function POST(request, { params }) {
  const { id } = await params;

  try {
    // Pull all case data
    const { data: c, error } = await db
      .from("cases")
      .select(`
        *,
        attorney:team_members!cases_attorney_id_fkey(name),
        support:team_members!cases_support_id_fkey(name),
        claim_details(*),
        litigation_details(*),
        negotiations(*),
        estimates(*),
        pleadings(*),
        case_notes(*)
      `)
      .eq("id", id)
      .single();

    if (error || !c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // Get document count and recent emails count
    const [docsRes, emailsRes] = await Promise.all([
      db.from("documents").select("id, filename, category, ai_summary", { count: "exact" }).eq("case_id", id).limit(20),
      db.from("case_emails").select("id, subject, date, direction", { count: "exact" }).eq("case_id", id).order("date", { ascending: false }).limit(10),
    ]);

    const docs = docsRes.data || [];
    const docCount = docsRes.count || 0;
    const emails = emailsRes.data || [];
    const emailCount = emailsRes.count || 0;

    // Compute key metrics
    const now = new Date();
    const sol = c.statute_of_limitations ? new Date(c.statute_of_limitations + "T00:00:00") : null;
    const solDays = sol ? Math.ceil((sol - now) / 86400000) : null;
    const negs = (c.negotiations || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastDemand = negs.find(n => n.type === "plaintiff_offer" || n.type === "presuit_demand");
    const lastOffer = negs.find(n => n.type === "defendant_offer");
    const claims = c.claim_details?.[0] || {};
    const lit = c.litigation_details?.[0] || {};
    const notes = c.case_notes || [];

    // Build context for AI
    const caseContext = {
      client: c.client_name,
      ref: c.ref,
      type: c.type || c.cause_of_loss,
      status: c.status,
      jurisdiction: c.jurisdiction,
      insurer: c.insurer,
      claimNumber: c.claim_number,
      policyNumber: c.policy_number,
      dateOfLoss: c.date_of_loss,
      dateOpened: c.date_opened,
      sol: c.statute_of_limitations,
      solDays,
      attorney: c.attorney?.name,
      support: c.support?.name,
      propertyAddress: c.property_address,
      causeOfLoss: c.cause_of_loss,
      totalRecovery: c.total_recovery,
      attorneyFees: c.attorney_fees,
      lastDemand: lastDemand ? { amount: lastDemand.amount, date: lastDemand.date } : null,
      lastOffer: lastOffer ? { amount: lastOffer.amount, date: lastOffer.date } : null,
      negotiationCount: negs.length,
      docCount,
      emailCount,
      claimDetails: claims,
      litigationDetails: lit,
      recentNotes: notes.slice(0, 5).map(n => n.content?.substring(0, 200)),
      recentEmails: emails.slice(0, 5).map(e => ({ subject: e.subject, date: e.date, direction: e.direction })),
      docSummaries: docs.filter(d => d.ai_summary).slice(0, 5).map(d => ({ filename: d.filename, summary: d.ai_summary?.substring(0, 150) })),
    };

    let summaryText;
    let model = "structured";

    // Try OpenAI if key exists
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        summaryText = await generateOpenAISummary(openaiKey, caseContext);
        model = "gpt-4o-mini";
      } catch (err) {
        console.error("OpenAI summary failed, falling back:", err.message);
        summaryText = generateStructuredSummary(caseContext);
      }
    } else {
      summaryText = generateStructuredSummary(caseContext);
    }

    // Cache it
    const summaryData = {
      solDays,
      negotiationCount: negs.length,
      lastDemand: caseContext.lastDemand,
      lastOffer: caseContext.lastOffer,
      docCount,
      emailCount,
      risks: computeRisks(caseContext),
      nextSteps: computeNextSteps(caseContext),
    };

    await db.from("case_summaries").upsert({
      case_id: id,
      summary_text: summaryText,
      summary_data: summaryData,
      model,
      updated_at: new Date().toISOString(),
    }, { onConflict: "case_id" });

    return NextResponse.json({ summary: summaryText, data: summaryData, cached: false, model });
  } catch (err) {
    console.error("Summary generation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function generateOpenAISummary(apiKey, ctx) {
  const prompt = `You are a legal case management assistant for a property insurance law firm. Generate a concise 2-3 paragraph executive summary for this case.

Case Data:
- Client: ${ctx.client} (Ref: ${ctx.ref})
- Type: ${ctx.type || "N/A"} | Status: ${ctx.status} | Jurisdiction: ${ctx.jurisdiction}
- Insurer: ${ctx.insurer} | Claim #: ${ctx.claimNumber || "N/A"}
- Date of Loss: ${ctx.dateOfLoss || "N/A"} | SOL: ${ctx.sol || "N/A"} (${ctx.solDays != null ? ctx.solDays + " days remaining" : "unknown"})
- Attorney: ${ctx.attorney || "Unassigned"} | Support: ${ctx.support || "Unassigned"}
- Property: ${ctx.propertyAddress || "N/A"} | Cause: ${ctx.causeOfLoss || "N/A"}
- Recovery: $${ctx.totalRecovery || 0} | Last Demand: ${ctx.lastDemand ? "$" + ctx.lastDemand.amount + " on " + ctx.lastDemand.date : "None"} | Last Offer: ${ctx.lastOffer ? "$" + ctx.lastOffer.amount + " on " + ctx.lastOffer.date : "None"}
- ${ctx.negotiationCount} negotiations, ${ctx.docCount} documents, ${ctx.emailCount} emails
${ctx.recentNotes?.length ? "- Recent notes: " + ctx.recentNotes.join("; ") : ""}

Include: case posture, key dates, current status, next steps, and risk factors. Be specific and actionable. Write for an attorney reviewing the case.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function generateStructuredSummary(ctx) {
  const parts = [];

  // Paragraph 1: Case posture
  parts.push(`${ctx.client} (${ctx.ref}) is a ${ctx.type || "property insurance"} case against ${ctx.insurer || "unknown insurer"} in ${ctx.jurisdiction || "unknown jurisdiction"}, currently in ${ctx.status || "unknown"} status. The date of loss was ${ctx.dateOfLoss || "not recorded"}${ctx.causeOfLoss ? ` due to ${ctx.causeOfLoss}` : ""}. The case is assigned to ${ctx.attorney || "no attorney"}${ctx.support ? ` with support from ${ctx.support}` : ""}.`);

  // Paragraph 2: Financials and negotiations
  const finParts = [];
  if (ctx.lastDemand) finParts.push(`The most recent demand was $${Number(ctx.lastDemand.amount).toLocaleString()} on ${ctx.lastDemand.date}`);
  if (ctx.lastOffer) finParts.push(`the last offer from the insurer was $${Number(ctx.lastOffer.amount).toLocaleString()} on ${ctx.lastOffer.date}`);
  if (ctx.totalRecovery > 0) finParts.push(`total recovery to date is $${Number(ctx.totalRecovery).toLocaleString()}`);
  if (finParts.length > 0) {
    parts.push(finParts.join("; ") + `. There have been ${ctx.negotiationCount} negotiation${ctx.negotiationCount !== 1 ? "s" : ""} recorded, with ${ctx.docCount} documents and ${ctx.emailCount} emails on file.`);
  } else {
    parts.push(`No negotiation activity has been recorded yet. The case has ${ctx.docCount} documents and ${ctx.emailCount} emails on file.`);
  }

  // Paragraph 3: Risks and next steps
  const risks = computeRisks(ctx);
  const steps = computeNextSteps(ctx);
  if (risks.length > 0 || steps.length > 0) {
    const riskText = risks.length > 0 ? `Risk factors: ${risks.map(r => r.message).join("; ")}.` : "";
    const stepText = steps.length > 0 ? `Recommended next steps: ${steps.join("; ")}.` : "";
    parts.push([riskText, stepText].filter(Boolean).join(" "));
  }

  return parts.join("\n\n");
}

function computeRisks(ctx) {
  const risks = [];
  if (ctx.solDays != null && ctx.solDays < 90) {
    risks.push({ severity: ctx.solDays < 30 ? "critical" : "warning", message: `SOL expires in ${ctx.solDays} days (${ctx.sol})` });
  }
  if (!ctx.attorney) {
    risks.push({ severity: "warning", message: "No attorney assigned" });
  }
  if (ctx.status === "Presuit" && ctx.dateOpened) {
    const daysInPresuit = Math.ceil((Date.now() - new Date(ctx.dateOpened).getTime()) / 86400000);
    if (daysInPresuit > 14) risks.push({ severity: "warning", message: `Case has been in Presuit for ${daysInPresuit} days` });
  }
  return risks;
}

function computeNextSteps(ctx) {
  const steps = [];
  if (ctx.status === "Presuit") steps.push("Complete intake documentation, investigation, and prepare demand package");
  if (ctx.status === "Presuit Demand") steps.push("Follow up on demand — check for response deadline");
  if (ctx.status === "Presuit Demand" && !ctx.lastOffer) steps.push("Await insurer response to demand");
  if (ctx.status === "Presuit Demand" && ctx.lastOffer) steps.push("Evaluate latest offer — prepare counter or file suit");
  if (ctx.status?.startsWith("Litigation")) steps.push("Review litigation deadlines and discovery schedule");
  if (ctx.solDays != null && ctx.solDays < 90 && !ctx.status?.startsWith("Litigation")) steps.push("URGENT: File suit before SOL expires");
  return steps;
}
