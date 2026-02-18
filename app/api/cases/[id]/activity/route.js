import { NextResponse } from "next/server";
import { supabaseAdmin, supabase } from "@/lib/supabase";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  try {
    if (!db) {
      return NextResponse.json({ error: "DB not configured" }, { status: 500 });
    }

    const { id } = await params;
    const feed = [];

    // Activity log
    const { data: logs } = await db
      .from("activity_log")
      .select("*")
      .eq("case_id", id);
    (logs || []).forEach(a => feed.push({
      id: `log-${a.id}`, date: a.date || a.created_at, type: a.type || "note",
      icon: "✍️", title: a.title || "Activity", desc: a.description,
      actor: a.actor_name, actorIni: a.actor_initials, actorClr: a.actor_color,
      meta: a,
    }));

    // Emails
    const { data: emails } = await db
      .from("case_emails")
      .select("*")
      .eq("case_id", id);
    (emails || []).forEach(e => feed.push({
      id: `email-${e.id}`, date: e.received_at || e.created_at, type: "email",
      icon: "✉️", title: `${e.direction === "outbound" ? "Sent" : "Received"}: ${e.subject || "(no subject)"}`,
      desc: `${e.direction === "outbound" ? "To" : "From"}: ${e.from_address || "unknown"}`,
      actor: e.from_address, actorIni: "E", actorClr: "#4a90d9",
      meta: { subject: e.subject, from: e.from_address, to: e.to_address, direction: e.direction },
    }));

    // Calls
    const { data: calls } = await db
      .from("case_calls")
      .select("*")
      .eq("case_id", id);
    (calls || []).forEach(c => feed.push({
      id: `call-${c.id}`, date: c.started_at || c.created_at, type: "call",
      icon: "📞", title: `Call: ${c.caller_name || ""} → ${c.callee_name || ""}`,
      desc: c.ai_summary || (c.transcript ? c.transcript.slice(0, 120) + "…" : ""),
      actor: c.caller_name, actorIni: "C", actorClr: "#386f4a",
      meta: { duration: c.duration_seconds, caller: c.caller_name, callee: c.callee_name },
    }));

    // Negotiations
    const { data: negs } = await db
      .from("negotiations")
      .select("*")
      .eq("case_id", id);
    (negs || []).forEach(n => feed.push({
      id: `neg-${n.id}`, date: n.date || n.created_at, type: "negotiation",
      icon: "💰", title: `${n.type || "Negotiation"}: $${Number(n.amount || 0).toLocaleString()}`,
      desc: n.notes, actor: n.by_name, actorIni: "N", actorClr: "#ebb003",
      meta: { amount: n.amount, negType: n.type },
    }));

    // Estimates
    const { data: ests } = await db
      .from("estimates")
      .select("*")
      .eq("case_id", id);
    (ests || []).forEach(e => feed.push({
      id: `est-${e.id}`, date: e.date || e.created_at, type: "estimate",
      icon: "📊", title: `Estimate: ${e.type || "General"} — $${Number(e.amount || 0).toLocaleString()}`,
      desc: e.notes, actor: e.vendor, actorIni: "E", actorClr: "#7b68ee",
      meta: { amount: e.amount, vendor: e.vendor, estType: e.type },
    }));

    // Pleadings
    const { data: pleads } = await db
      .from("pleadings")
      .select("*")
      .eq("case_id", id);
    (pleads || []).forEach(p => feed.push({
      id: `plead-${p.id}`, date: p.date || p.created_at, type: "pleading",
      icon: "⚖️", title: `${p.type || "Pleading"}: ${p.status || ""}`,
      desc: p.notes, actor: p.filed_by, actorIni: "P", actorClr: "#e74c3c",
      meta: { pleadType: p.type, status: p.status, filedBy: p.filed_by },
    }));

    // Documents
    const { data: docs } = await db
      .from("documents")
      .select("*")
      .eq("case_id", id);
    (docs || []).forEach(d => feed.push({
      id: `doc-${d.id}`, date: d.uploaded_at || d.created_at, type: "document",
      icon: "📄", title: `Document: ${d.filename || d.original_path || "Untitled"}`,
      desc: d.category || "", actor: null, actorIni: "D", actorClr: "#20b2aa",
      meta: { category: d.category, fileName: d.filename },
    }));

    // Tasks
    const { data: tasks } = await db
      .from("case_tasks")
      .select("*")
      .eq("case_id", id);
    (tasks || []).forEach(t => feed.push({
      id: `task-${t.id}`, date: t.created_at || t.due_date, type: "task",
      icon: t.completed ? "✅" : "☑️", title: `Task: ${t.title || t.description || ""}`,
      desc: t.completed ? "Completed" : `Due: ${t.due_date || "No date"}`,
      actor: t.assigned_to, actorIni: "T", actorClr: "#ff8c00",
      meta: { completed: t.completed, dueDate: t.due_date },
    }));

    // Sort by date descending
    feed.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return NextResponse.json(feed);
  } catch (e) {
    console.error("[case-activity] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
