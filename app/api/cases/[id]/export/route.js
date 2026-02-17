import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(v) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function statusBadge(status) {
  const colors = {
    active: "#386f4a", pending: "#e67e22", closed: "#666", litigation: "#cc3333",
    negotiation: "#2980b9", "pre-litigation": "#8e44ad",
  };
  const bg = colors[(status || "").toLowerCase()] || "#666";
  return `<span style="background:${bg};color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">${esc(status)}</span>`;
}

export async function GET(request, { params }) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: c, error } = await supabaseAdmin
    .from("cases")
    .select(`*, attorney:team_members!cases_attorney_id_fkey(name, email, title), support:team_members!cases_support_id_fkey(name, email, title)`)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.code === "PGRST116" ? "Case not found" : error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }

  const [claimRes, negotiationsRes, estimatesRes, timelineRes] = await Promise.all([
    supabaseAdmin.from("claim_details").select("*").eq("case_id", id).maybeSingle(),
    supabaseAdmin.from("negotiations").select("*").eq("case_id", id).order("date", { ascending: false }),
    supabaseAdmin.from("estimates").select("*").eq("case_id", id).order("date", { ascending: false }),
    supabaseAdmin.from("case_timeline").select("*").eq("case_id", id).order("date", { ascending: false }).limit(50),
  ]);

  const claim = claimRes.data;
  const negotiations = negotiationsRes.data || [];
  const estimates = estimatesRes.data || [];
  const timeline = timelineRes.data || [];

  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Case Summary – ${esc(c.client_name)} – ${esc(c.reference_number)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a1a; background: #fff; line-height: 1.6; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px; }
  
  /* Header */
  .header { border-bottom: 3px solid #000066; padding-bottom: 20px; margin-bottom: 30px; }
  .firm-name { font-size: 24px; font-weight: bold; color: #000066; letter-spacing: 1px; }
  .firm-tagline { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
  .case-title { font-size: 20px; margin-top: 16px; color: #1a1a1a; }
  .case-meta { display: flex; gap: 20px; align-items: center; margin-top: 8px; font-size: 13px; color: #555; }
  
  /* Sections */
  .section { margin-bottom: 28px; }
  .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #000066; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 12px; }
  
  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .info-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; display: block; }
  .info-item span { font-size: 14px; color: #1a1a1a; }
  
  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; background: #f5f5f5; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  
  /* Timeline */
  .timeline-item { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .timeline-date { color: #888; min-width: 100px; flex-shrink: 0; }
  .timeline-desc { color: #333; }
  
  /* Footer */
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
  
  /* Print */
  @media print {
    body { font-size: 12px; }
    .container { padding: 20px; }
    .no-print { display: none; }
    @page { margin: 0.75in; }
  }
  
  .print-btn { position: fixed; top: 20px; right: 20px; background: #000066; color: #fff; border: none; padding: 10px 20px; font-size: 14px; cursor: pointer; border-radius: 4px; font-family: sans-serif; }
  .print-btn:hover { background: #000099; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="container">
  <div class="header">
    <div class="firm-name">DENHAM LAW</div>
    <div class="firm-tagline">Insurance Claims &amp; Property Damage</div>
    <div class="case-title">${esc(c.client_name)}</div>
    <div class="case-meta">
      <span><strong>Ref:</strong> ${esc(c.reference_number)}</span>
      <span>${statusBadge(c.status)}</span>
      ${c.attorney ? `<span><strong>Attorney:</strong> ${esc(c.attorney.name)}</span>` : ""}
    </div>
  </div>

  <!-- Case Overview -->
  <div class="section">
    <div class="section-title">Case Overview</div>
    <div class="info-grid">
      <div class="info-item"><label>Client Name</label><span>${esc(c.client_name)}</span></div>
      <div class="info-item"><label>Reference #</label><span>${esc(c.reference_number)}</span></div>
      <div class="info-item"><label>Status</label><span>${esc(c.status)}</span></div>
      <div class="info-item"><label>Case Type</label><span>${esc(c.case_type || c.cause_of_loss)}</span></div>
      <div class="info-item"><label>Date of Loss</label><span>${fmtDate(c.date_of_loss)}</span></div>
      <div class="info-item"><label>Date Opened</label><span>${fmtDate(c.created_at)}</span></div>
      ${c.attorney ? `<div class="info-item"><label>Attorney</label><span>${esc(c.attorney.name)}${c.attorney.title ? ` — ${esc(c.attorney.title)}` : ""}</span></div>` : ""}
      ${c.support ? `<div class="info-item"><label>Support</label><span>${esc(c.support.name)}</span></div>` : ""}
    </div>
  </div>

  <!-- Property Information -->
  <div class="section">
    <div class="section-title">Property Information</div>
    <div class="info-grid">
      <div class="info-item"><label>Property Address</label><span>${esc(c.property_address)}</span></div>
      <div class="info-item"><label>Cause of Loss</label><span>${esc(c.cause_of_loss)}</span></div>
      ${c.property_type ? `<div class="info-item"><label>Property Type</label><span>${esc(c.property_type)}</span></div>` : ""}
      ${c.year_built ? `<div class="info-item"><label>Year Built</label><span>${esc(c.year_built)}</span></div>` : ""}
    </div>
  </div>

  <!-- Insurance Details -->
  ${claim ? `
  <div class="section">
    <div class="section-title">Insurance Details</div>
    <div class="info-grid">
      ${claim.insurance_company ? `<div class="info-item"><label>Insurance Company</label><span>${esc(claim.insurance_company)}</span></div>` : ""}
      ${claim.policy_number ? `<div class="info-item"><label>Policy #</label><span>${esc(claim.policy_number)}</span></div>` : ""}
      ${claim.claim_number ? `<div class="info-item"><label>Claim #</label><span>${esc(claim.claim_number)}</span></div>` : ""}
      ${claim.adjuster_name ? `<div class="info-item"><label>Adjuster</label><span>${esc(claim.adjuster_name)}</span></div>` : ""}
      ${claim.adjuster_email ? `<div class="info-item"><label>Adjuster Email</label><span>${esc(claim.adjuster_email)}</span></div>` : ""}
      ${claim.adjuster_phone ? `<div class="info-item"><label>Adjuster Phone</label><span>${esc(claim.adjuster_phone)}</span></div>` : ""}
      ${claim.deductible != null ? `<div class="info-item"><label>Deductible</label><span>${fmtMoney(claim.deductible)}</span></div>` : ""}
      ${claim.policy_limit != null ? `<div class="info-item"><label>Policy Limit</label><span>${fmtMoney(claim.policy_limit)}</span></div>` : ""}
    </div>
  </div>` : ""}

  <!-- Financial Summary -->
  <div class="section">
    <div class="section-title">Financial Summary</div>
    <div class="info-grid">
      ${c.claimed_amount != null ? `<div class="info-item"><label>Claimed Amount</label><span>${fmtMoney(c.claimed_amount)}</span></div>` : ""}
      ${c.insurance_estimate != null ? `<div class="info-item"><label>Insurance Estimate</label><span>${fmtMoney(c.insurance_estimate)}</span></div>` : ""}
      ${c.our_estimate != null ? `<div class="info-item"><label>Our Estimate</label><span>${fmtMoney(c.our_estimate)}</span></div>` : ""}
      ${c.settlement_amount != null ? `<div class="info-item"><label>Settlement</label><span>${fmtMoney(c.settlement_amount)}</span></div>` : ""}
    </div>
    ${estimates.length > 0 ? `
    <table style="margin-top:16px">
      <thead><tr><th>Date</th><th>Source</th><th>Amount</th><th>Notes</th></tr></thead>
      <tbody>${estimates.map(e => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.source || e.type)}</td><td>${fmtMoney(e.amount)}</td><td>${esc(e.notes || "")}</td></tr>`).join("")}</tbody>
    </table>` : ""}
  </div>

  <!-- Negotiation History -->
  ${negotiations.length > 0 ? `
  <div class="section">
    <div class="section-title">Negotiation History</div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Notes</th></tr></thead>
      <tbody>${negotiations.map(n => `<tr><td>${fmtDate(n.date)}</td><td>${esc(n.type || n.direction)}</td><td>${fmtMoney(n.amount)}</td><td>${esc(n.notes || "")}</td></tr>`).join("")}</tbody>
    </table>
  </div>` : ""}

  <!-- Key Dates / Timeline -->
  ${timeline.length > 0 ? `
  <div class="section">
    <div class="section-title">Timeline</div>
    ${timeline.map(t => `<div class="timeline-item"><span class="timeline-date">${fmtDate(t.date)}</span><span class="timeline-desc"><strong>${esc(t.type || t.event_type || "")}</strong> ${esc(t.description || t.notes || "")}</span></div>`).join("")}
  </div>` : ""}

  <div class="footer">
    Generated ${esc(generatedAt)} · Denham Law · Confidential
  </div>
</div>
</body>
</html>`;

  const filename = `Case-Summary-${(c.reference_number || c.client_name || id).replace(/[^a-zA-Z0-9-_]/g, "_")}.html`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
