import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // email, call, note, message, all

  try {
    const [emailsRes, callsRes, notesRes, messagesRes, smsRes] = await Promise.all([
      db.from("case_emails").select("id, subject, from_address, to_address, direction, received_at, body_text, body_html").eq("case_id", id).order("received_at", { ascending: false }).limit(200),
      db.from("case_calls").select("id, direction, category, caller_name, external_number, duration_seconds, started_at, ai_summary, transcript").eq("case_id", id).order("started_at", { ascending: false }).limit(200),
      db.from("activity_log").select("*").eq("case_id", id).eq("type", "note").order("date", { ascending: false }).limit(200),
      db.from("portal_messages").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(200),
      db.from("case_sms").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(200),
    ]);

    const items = [];

    if (!type || type === "all" || type === "email") {
      for (const e of emailsRes.data || []) {
        items.push({
          id: `email-${e.id}`, type: "email", date: e.received_at,
          title: e.subject || "(No subject)",
          subtitle: e.direction === "inbound" ? `From: ${e.from_address}` : `To: ${e.to_address}`,
          direction: e.direction, content: e.body_text || e.body_html || "",
          icon: "📧",
        });
      }
    }

    if (!type || type === "all" || type === "call") {
      for (const c of callsRes.data || []) {
        const dur = c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : "";
        items.push({
          id: `call-${c.id}`, type: "call", date: c.started_at,
          title: `${c.direction === "inbound" ? "Incoming" : "Outgoing"} Call${c.caller_name ? ` - ${c.caller_name}` : ""}`,
          subtitle: `${c.external_number || ""} ${dur ? `(${dur})` : ""}`.trim(),
          direction: c.direction, content: c.ai_summary || c.transcript || "",
          icon: "📞",
        });
      }
    }

    if (!type || type === "all" || type === "note") {
      for (const n of notesRes.data || []) {
        items.push({
          id: `note-${n.id}`, type: "note", date: n.date || n.created_at,
          title: "Note",
          subtitle: n.actor_name || n.actor || "Staff",
          content: n.description || "", icon: "📝",
        });
      }
    }

    if (!type || type === "all" || type === "message") {
      for (const m of messagesRes.data || []) {
        items.push({
          id: `msg-${m.id}`, type: "message", date: m.created_at,
          title: "Portal Message",
          subtitle: m.sender_name || m.sender_type || "Client",
          content: m.content || m.message || "", icon: "💬",
        });
      }
    }

    if (!type || type === "all" || type === "sms") {
      for (const s of smsRes.data || []) {
        items.push({
          id: `sms-${s.id}`, type: "sms", date: s.created_at,
          title: `${s.direction === "inbound" ? "Incoming" : "Outgoing"} SMS`,
          subtitle: s.phone_number || "",
          direction: s.direction, content: s.message || "", icon: "📱",
        });
      }
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({ communications: items, total: items.length });
  } catch (err) {
    console.error("Communications API error:", err);
    return NextResponse.json({ communications: [], error: err.message });
  }
}
