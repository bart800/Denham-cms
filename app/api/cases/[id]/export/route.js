import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

function esc(str) {
  if (!str) return "—";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
function fmtMoney(v) { if (v == null || v === 0) return "—"; return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v); }

export async function GET(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { data: c, error } = await supabaseAdmin
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Get attorney/support names
  let attorney = null, support = null;
  if (c.attorney_id) {
    const { data } = await supabaseAdmin.from("team_members").select("name,email,title").eq("id", c.attorney_id).single();
    attorney = data;
  }
  if (c.support_id) {
    const { data } = await supabaseAdmin.from("team_members").select("name,email,title").eq("id", c.support_id).single();
    support = data;
  }

  // Get related data (gracefully handle missing tables)
  let negotiations = [], estimates = [], timeline = [];
  try { const r = await supabaseAdmin.from("negotiations").select("*").eq("case_id", id).order("date", { ascending: false }); negotiations = r.data || []; } catch {}
  try { const r = await supabaseAdmin.from("estimates").select("*").eq("case_id", id).order("created_at", { ascending: false }); estimates = r.data || []; } catch {}
  try { const r = await supabaseAdmin.from("activity_log").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(30); timeline = r.data || []; } catch {}

  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Case Summary - ${esc(c.client_name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;color:#1a1a1a;background:#fff;line-height:1.6}
.container{max-width:800px;margin:0 auto;padding:40px}
.header{border-bottom:3px solid #000066;padding-bottom:20px;margin-bottom:30px}
.firm{font-size:24px;font-weight:bold;color:#000066;letter-spacing:1px}
.addr{font-size:11px;color:#666;margin-top:2px}
.case-title{font-size:20px;margin-top:16px}.meta{font-size:13px;color:#555;margin-top:8px}
.section{margin-bottom:28px}.stitle{font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:#000066;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
.item label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#888;display:block}
.item span{font-size:14px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
th{text-align:left;background:#f5f5f5;padding:8px 10px;font-size:11px;text-transform:uppercase;color:#555;border-bottom:2px solid #ddd}
td{padding:8px 10px;border-bottom:1px solid #eee}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}
.btn{position:fixed;top:20px;right:20px;background:#000066;color:#fff;border:none;padding:10px 20px;font-size:14px;cursor:pointer;border-radius:4px;font-family:sans-serif}
@media print{.btn{display:none}@page{margin:.75in}}
</style></head><body>
<button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="container">
<div class="header">
<div class="firm">DENHAM PROPERTY AND INJURY LAW FIRM</div>
<div class="addr">250 W. Main St. Suite 120, Lexington, KY 40507 · (859) 900-2278 · www.denim.law</div>
<div class="case-title">${esc(c.client_name)}</div>
<div class="meta"><strong>Ref:</strong> ${esc(c.ref)} · <strong>Status:</strong> ${esc(c.status)} · <strong>Jurisdiction:</strong> ${esc(c.jurisdiction)}</div>
</div>

<div class="section"><div class="stitle">Case Overview</div><div class="grid">
<div class="item"><label>Client</label><span>${esc(c.client_name)}</span></div>
<div class="item"><label>Reference</label><span>${esc(c.ref)}</span></div>
<div class="item"><label>Status</label><span>${esc(c.status)}</span></div>
<div class="item"><label>Loss Type</label><span>${esc(c.type)}</span></div>
<div class="item"><label>Date of Loss</label><span>${fmtDate(c.date_of_loss)}</span></div>
<div class="item"><label>Date Opened</label><span>${fmtDate(c.date_opened)}</span></div>
<div class="item"><label>SOL</label><span>${fmtDate(c.statute_of_limitations)}</span></div>
<div class="item"><label>Jurisdiction</label><span>${esc(c.jurisdiction)}</span></div>
${attorney ? `<div class="item"><label>Attorney</label><span>${esc(attorney.name)}</span></div>` : ""}
${support ? `<div class="item"><label>Support</label><span>${esc(support.name)}</span></div>` : ""}
<div class="item"><label>Client Phone</label><span>${esc(c.client_phone)}</span></div>
<div class="item"><label>Client Email</label><span>${esc(c.client_email)}</span></div>
</div></div>

<div class="section"><div class="stitle">Property & Insurance</div><div class="grid">
<div class="item"><label>Property Address</label><span>${esc(c.property_address)}</span></div>
<div class="item"><label>Cause of Loss</label><span>${esc(c.cause_of_loss)}</span></div>
<div class="item"><label>Insurer</label><span>${esc(c.insurer)}</span></div>
<div class="item"><label>Claim #</label><span>${esc(c.claim_number)}</span></div>
<div class="item"><label>Policy #</label><span>${esc(c.policy_number)}</span></div>
<div class="item"><label>Adjuster</label><span>${esc(c.adjuster_name)}</span></div>
<div class="item"><label>Adjuster Phone</label><span>${esc(c.adjuster_phone)}</span></div>
<div class="item"><label>Adjuster Email</label><span>${esc(c.adjuster_email)}</span></div>
</div></div>

<div class="section"><div class="stitle">Financial Summary</div><div class="grid">
<div class="item"><label>Total Recovery</label><span>${fmtMoney(c.total_recovery)}</span></div>
<div class="item"><label>Attorney Fees</label><span>${fmtMoney(c.attorney_fees)}</span></div>
</div></div>

${negotiations.length > 0 ? `<div class="section"><div class="stitle">Negotiation History</div>
<table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Notes</th></tr></thead>
<tbody>${negotiations.map(n => `<tr><td>${fmtDate(n.date)}</td><td>${esc(n.type)}</td><td>${fmtMoney(n.amount)}</td><td>${esc(n.notes)}</td></tr>`).join("")}</tbody></table></div>` : ""}

${timeline.length > 0 ? `<div class="section"><div class="stitle">Activity Log</div>
<table><thead><tr><th>Date</th><th>Type</th><th>Description</th></tr></thead>
<tbody>${timeline.map(t => `<tr><td>${fmtDate(t.created_at)}</td><td>${esc(t.type)}</td><td>${esc(t.description)}</td></tr>`).join("")}</tbody></table></div>` : ""}

<div class="footer">Generated ${esc(generatedAt)} · Denham Property and Injury Law Firm · Confidential</div>
</div></body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="Case-Summary-${(c.ref || c.client_name || id).replace(/[^a-zA-Z0-9-_]/g, "_")}.html"` },
  });
}
