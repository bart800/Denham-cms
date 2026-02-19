import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();

  // If requesting AI generation
  if (body.generate) {
    try {
      const letter = await generateDemandLetter(id);
      return NextResponse.json(letter);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Save a demand
  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .insert({
      case_id: id,
      title: body.title || "Demand Letter",
      content: body.content,
      html_content: body.html_content,
      demand_amount: body.demand_amount,
      status: body.status || "draft",
      created_by: body.created_by,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { demand_id, ...updates } = body;
  if (!demand_id) return NextResponse.json({ error: "demand_id required" }, { status: 400 });

  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .update(updates)
    .eq("id", demand_id)
    .eq("case_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const demandId = searchParams.get("demand_id");
  if (!demandId) return NextResponse.json({ error: "demand_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("case_demands")
    .delete()
    .eq("id", demandId)
    .eq("case_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

async function generateDemandLetter(caseId) {
  // Fetch all case data
  const [caseRes, claimRes, negRes, estRes] = await Promise.all([
    supabaseAdmin.from("cases").select("*").eq("id", caseId).single(),
    supabaseAdmin.from("claim_details").select("*").eq("case_id", caseId).maybeSingle(),
    supabaseAdmin.from("negotiations").select("*").eq("case_id", caseId).order("date", { ascending: false }),
    supabaseAdmin.from("estimates").select("*").eq("case_id", caseId).order("date", { ascending: false }),
  ]);

  const c = caseRes.data;
  if (!c) throw new Error("Case not found");
  const claim = claimRes.data;
  const negotiations = negRes.data || [];
  const estimates = estRes.data || [];

  const totalEstimates = estimates.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const latestOffer = negotiations.find(n => n.type === "offer");

  const caseContext = `
Case: ${c.client_name} v. ${c.insurer || "Unknown Insurer"}
Ref: ${c.ref || "N/A"}
Type: ${c.case_type || "Property Insurance"}
Jurisdiction: ${c.jurisdiction || "Unknown"}
Date of Loss: ${c.date_of_loss || "Unknown"}
Policy Number: ${c.policy_number || "Unknown"}
Claim Number: ${c.claim_number || "Unknown"}
Status: ${c.status || "Unknown"}
Insurer: ${c.insurer || "Unknown"}
${claim ? `Claim Type: ${claim.claim_type || "N/A"}\nCause of Loss: ${claim.cause_of_loss || "N/A"}\nCoverage: ${claim.coverage_type || "N/A"}` : ""}
Total Estimates: $${totalEstimates.toLocaleString()}
${latestOffer ? `Latest Insurer Offer: $${parseFloat(latestOffer.amount || 0).toLocaleString()} on ${latestOffer.date}` : "No offers received"}
Number of Estimates: ${estimates.length}
Number of Negotiations: ${negotiations.length}
${c.notes ? `Notes: ${c.notes}` : ""}
`.trim();

  const openaiKey = process.env.OPENAI_API_KEY;
  let content, htmlContent;

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert insurance property damage attorney drafting a demand letter. Write a professional, persuasive demand letter based on the case details provided. Include:
1. Formal letterhead format (use [FIRM NAME] and [FIRM ADDRESS] as placeholders)
2. Statement of representation
3. Facts of the loss
4. Policy provisions and coverage analysis
5. Damages summary with itemized amounts
6. Demand amount (suggest 1.5-2x the total estimates if no prior demands)
7. Response deadline (30 days)
8. Closing with bad faith warning if applicable

Format the output as clean HTML suitable for printing. Use professional legal language.`
            },
            { role: "user", content: `Generate a demand letter for this case:\n\n${caseContext}` }
          ],
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
      const json = await res.json();
      htmlContent = json.choices[0].message.content;
      content = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } catch (err) {
      console.error("OpenAI demand generation failed:", err.message);
      // Fall through to template
    }
  }

  if (!htmlContent) {
    // Template-based fallback
    const demandAmount = totalEstimates * 1.5 || 50000;
    htmlContent = buildTemplateDemand(c, claim, estimates, negotiations, totalEstimates, demandAmount);
    content = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const demandAmount = totalEstimates * 1.5 || 50000;

  // Save to DB
  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .insert({
      case_id: caseId,
      title: `Demand Letter - ${c.client_name} v. ${c.insurer || "Insurer"}`,
      content,
      html_content: htmlContent,
      demand_amount: demandAmount,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function buildTemplateDemand(c, claim, estimates, negotiations, totalEstimates, demandAmount) {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const deadline = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const estRows = estimates.map(e => `<tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">${e.description || e.category || "Repair"}</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${parseFloat(e.amount || 0).toLocaleString()}</td></tr>`).join("");

  return `
<div style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.7;color:#222;">
  <div style="text-align:center;margin-bottom:40px;border-bottom:2px solid #000066;padding-bottom:20px;">
    <h1 style="font-size:22px;color:#000066;margin:0;">DENHAM LAW</h1>
    <p style="margin:4px 0;font-size:13px;color:#555;">[Firm Address] | [Phone] | [Email]</p>
  </div>

  <p style="margin-bottom:8px;">${today}</p>
  <p style="margin-bottom:4px;"><strong>VIA CERTIFIED MAIL</strong></p>
  <p style="margin-bottom:4px;">${c.insurer || "[Insurance Company]"}</p>
  <p style="margin-bottom:4px;">Claims Department</p>
  <p style="margin-bottom:4px;">Re: ${c.client_name}</p>
  <p style="margin-bottom:4px;">Claim No.: ${c.claim_number || "[Claim Number]"}</p>
  <p style="margin-bottom:4px;">Policy No.: ${c.policy_number || "[Policy Number]"}</p>
  <p style="margin-bottom:20px;">Date of Loss: ${c.date_of_loss || "[Date of Loss]"}</p>

  <p>Dear Claims Representative:</p>

  <p>This firm represents <strong>${c.client_name}</strong> regarding the above-referenced ${claim?.claim_type || "property damage"} claim under ${c.insurer ? c.insurer + "'s" : "your"} policy of insurance. This letter constitutes a formal demand for payment of all covered damages.</p>

  <h3 style="color:#000066;border-bottom:1px solid #ccc;padding-bottom:6px;">FACTS OF LOSS</h3>
  <p>On or about ${c.date_of_loss || "[date]"}, the insured property sustained ${claim?.cause_of_loss || "significant damage"}. ${claim?.description || "The property suffered damages covered under the terms of the insurance policy."}</p>

  <h3 style="color:#000066;border-bottom:1px solid #ccc;padding-bottom:6px;">DAMAGES</h3>
  ${estimates.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead><tr style="background:#f5f5f5;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #000066;">Description</th><th style="padding:8px 12px;text-align:right;border-bottom:2px solid #000066;">Amount</th></tr></thead>
    <tbody>${estRows}</tbody>
    <tfoot><tr style="font-weight:bold;"><td style="padding:8px 12px;border-top:2px solid #000066;">TOTAL</td><td style="padding:8px 12px;text-align:right;border-top:2px solid #000066;">$${totalEstimates.toLocaleString()}</td></tr></tfoot>
  </table>` : `<p>Detailed estimates are being compiled and will supplement this demand.</p>`}

  <h3 style="color:#000066;border-bottom:1px solid #ccc;padding-bottom:6px;">DEMAND</h3>
  <p>Based on the foregoing, we hereby demand payment in the amount of <strong>$${demandAmount.toLocaleString()}</strong> to fully and fairly compensate our client for all covered damages, including but not limited to repair costs, additional living expenses, and all consequential damages permitted under the policy.</p>

  <p>Please respond to this demand on or before <strong>${deadline}</strong>. Failure to respond or to make a reasonable settlement offer may constitute bad faith claims handling under applicable ${c.jurisdiction || "state"} law, subjecting your company to additional liability including consequential damages, attorney fees, and punitive damages.</p>

  <p>We reserve all rights and remedies available to our client under the policy and applicable law.</p>

  <p style="margin-top:30px;">Respectfully,</p>
  <p style="margin-top:40px;"><strong>Bart Denham, Esq.</strong><br/>Denham Law</p>
</div>`;
}
