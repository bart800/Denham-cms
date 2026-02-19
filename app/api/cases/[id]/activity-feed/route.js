import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin;
  if (!db) return NextResponse.json({ error: "No database" }, { status: 500 });

  try {
    // Fetch from all sources in parallel
    const [emailsRes, callsRes, negsRes, notesRes, activityRes] = await Promise.all([
      db.from("case_emails").select("id, subject, from_address, to_address, direction, received_at").eq("case_id", id).order("received_at", { ascending: false }).limit(50),
      db.from("case_calls").select("id, caller_name, caller_number, direction, duration, started_at, status").eq("case_id", id).order("started_at", { ascending: false }).limit(50),
      db.from("negotiations").select("id, type, amount, date, notes").eq("case_id", id).order("date", { ascending: false }).limit(50),
      db.from("case_notes").select("id, content, pinned, created_at, author_id, team_members:author_id(name)").eq("case_id", id).order("created_at", { ascending: false }).limit(50),
      db.from("activity_log").select("id, type, description, created_at, team_members:user_id(name)").eq("case_id", id).order("created_at", { ascending: false }).limit(50),
    ]);

    const feed = [];

    // Emails
    (emailsRes.data || []).forEach(e => {
      feed.push({
        id: `email-${e.id}`,
        type: "email",
        date: e.received_at,
        title: e.direction === "inbound" ? `Email from ${e.from_address || "unknown"}` : `Email to ${e.to_address || "unknown"}`,
        desc: e.subject || "(no subject)",
        actor: e.direction === "inbound" ? (e.from_address || "").split("@")[0] : "Staff",
        aIni: e.direction === "inbound" ? "📨" : "📤",
        aClr: e.direction === "inbound" ? "#5b8def" : "#386f4a",
      });
    });

    // Calls
    (callsRes.data || []).forEach(c => {
      const dur = c.duration ? `${Math.round(c.duration / 60)}min` : "";
      feed.push({
        id: `call-${c.id}`,
        type: "call",
        date: c.started_at,
        title: c.direction === "inbound" ? `Call from ${c.caller_name || c.caller_number || "unknown"}` : `Call to ${c.caller_name || c.caller_number || "unknown"}`,
        desc: [c.status, dur].filter(Boolean).join(" · "),
        actor: c.caller_name || "Unknown",
        aIni: "📞",
        aClr: "#7c5cbf",
      });
    });

    // Negotiations
    (negsRes.data || []).forEach(n => {
      const typeLabel = (n.type || "").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      feed.push({
        id: `neg-${n.id}`,
        type: "negotiation",
        date: n.date ? n.date + "T12:00:00Z" : null,
        title: `${typeLabel}: $${Number(n.amount || 0).toLocaleString()}`,
        desc: n.notes || "",
        actor: "Negotiation",
        aIni: "💰",
        aClr: "#ebb003",
      });
    });

    // Notes
    (notesRes.data || []).forEach(n => {
      feed.push({
        id: `note-${n.id}`,
        type: "note",
        date: n.created_at,
        title: "Note added",
        desc: (n.content || "").substring(0, 120),
        actor: n.team_members?.name || "Staff",
        aIni: "✍️",
        aClr: "#888",
      });
    });

    // Activity log entries
    (activityRes.data || []).forEach(a => {
      feed.push({
        id: `act-${a.id}`,
        type: a.type || "status_change",
        date: a.created_at,
        title: a.description || "",
        desc: "",
        actor: a.team_members?.name || "System",
        aIni: "🔄",
        aClr: "#5b8def",
      });
    });

    // Sort by date desc
    feed.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return NextResponse.json({ feed: feed.slice(0, 100), total: feed.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
