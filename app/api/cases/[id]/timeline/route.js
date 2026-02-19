import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!db) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    // Fetch ALL sources in parallel
    const [activityRes, negotiationsRes, estimatesRes, pleadingsRes, emailsRes, callsRes, caseRes] = await Promise.all([
      db.from("activity_log").select("*").eq("case_id", id).order("date", { ascending: false }),
      db.from("negotiations").select("*").eq("case_id", id).order("date", { ascending: false }),
      db.from("estimates").select("*").eq("case_id", id).order("date", { ascending: false }),
      db.from("pleadings").select("*").eq("case_id", id).order("date", { ascending: false }),
      db.from("case_emails").select("id, subject, from_address, to_address, direction, received_at, body_text").eq("case_id", id).order("received_at", { ascending: false }).limit(100),
      db.from("case_calls").select("id, direction, category, caller_name, external_number, duration_seconds, started_at, ai_summary, transcript").eq("case_id", id).order("started_at", { ascending: false }).limit(100),
      db.from("cases").select("client_name, date_opened, date_of_loss, statute_of_limitations").eq("id", id).single(),
    ]);

    const events = [];

    // Activity log
    for (const a of activityRes.data || []) {
      events.push({
        id: `activity-${a.id}`, type: a.type || "note",
        date: a.date || a.created_at, description: a.description,
        actor: a.actor_name || a.actor || null, source: "activity_log",
      });
    }

    // Negotiations
    for (const n of negotiationsRes.data || []) {
      const isDemand = n.type === "demand" || n.type === "presuit_demand";
      const amount = Number(n.amount).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
      events.push({
        id: `negotiation-${n.id}`, type: "negotiation",
        date: n.date || n.created_at,
        description: isDemand ? `Demand sent ${amount}` : `${n.type || "Offer"}: ${amount}`,
        actor: n.by_name || null, source: "negotiations",
        amount: n.amount, notes: n.notes,
      });
    }

    // Estimates
    for (const e of estimatesRes.data || []) {
      const amount = Number(e.amount).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
      events.push({
        id: `estimate-${e.id}`, type: "estimate",
        date: e.date || e.created_at,
        description: `${e.type || "Estimate"}: ${amount}${e.vendor ? ` (${e.vendor})` : ""}`,
        actor: null, source: "estimates",
        amount: e.amount, notes: e.notes,
      });
    }

    // Pleadings
    for (const p of pleadingsRes.data || []) {
      events.push({
        id: `pleading-${p.id}`, type: "pleading",
        date: p.date || p.created_at,
        description: `${p.type || "Pleading"}${p.filed_by ? ` filed by ${p.filed_by}` : ""}${p.status ? ` — ${p.status}` : ""}`,
        actor: p.filed_by || null, source: "pleadings",
      });
    }

    // Emails
    for (const e of emailsRes.data || []) {
      const bodyPreview = e.body_text || null;
      events.push({
        id: `email-${e.id}`, type: "email",
        date: e.received_at,
        description: `${e.direction === "inbound" ? "📥" : "📤"} ${e.subject || "(no subject)"}`,
        actor: e.direction === "inbound" ? e.from_address : e.to_address,
        source: "case_emails",
        detail: bodyPreview,
      });
    }

    // Calls
    for (const c of callsRes.data || []) {
      const dur = c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}:${String(c.duration_seconds % 60).padStart(2, "0")}` : "";
      const detail = [c.ai_summary ? `**Summary:** ${c.ai_summary}` : null, c.transcript ? `**Transcript:**\n${c.transcript}` : null].filter(Boolean).join("\n\n") || null;
      events.push({
        id: `call-${c.id}`, type: "call",
        date: c.started_at,
        description: `${c.direction === "inbound" ? "📞 Incoming" : "📱 Outgoing"} call${c.caller_name ? ` — ${c.caller_name}` : ""}${dur ? ` (${dur})` : ""}`,
        actor: c.caller_name || c.external_number || null,
        source: "case_calls",
        detail: detail,
      });
    }

    // Case milestones
    const caseData = caseRes.data;
    if (caseData) {
      if (caseData.date_opened) events.push({ id: "milestone-opened", type: "milestone", date: caseData.date_opened, description: "Case opened", actor: null, source: "case" });
      if (caseData.date_of_loss) events.push({ id: "milestone-loss", type: "milestone", date: caseData.date_of_loss, description: "Date of loss", actor: null, source: "case" });
      if (caseData.statute_of_limitations) events.push({ id: "milestone-sol", type: "milestone", date: caseData.statute_of_limitations, description: "Statute of limitations", actor: null, source: "case" });
    }

    // Sort newest first
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    const filtered = type ? events.filter((e) => e.type === type) : events;

    return NextResponse.json({ timeline: filtered, total: filtered.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
