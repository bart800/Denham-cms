import { NextResponse } from "next/server";
import { supabaseAdmin, supabase } from "@/lib/supabase";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = supabaseAdmin || supabase;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    // Fetch from multiple sources in parallel
    const [calRes, caseRes, litRes, taskRes, discRes] = await Promise.all([
      db.from("calendar_events").select("*").eq("case_id", id).order("start_time", { ascending: true }),
      db.from("cases").select("statute_of_limitations, date_of_loss").eq("id", id).single(),
      db.from("litigation_details").select("trial_date, mediation_date, discovery_deadline, filed_date").eq("case_id", id).maybeSingle(),
      db.from("case_tasks").select("id, title, due_date, status, priority").eq("case_id", id).not("due_date", "is", null).order("due_date", { ascending: true }),
      db.from("discovery_sets").select("id, title, type, due_date, status").eq("case_id", id).not("due_date", "is", null),
    ]);

    const events = [];

    // Calendar events from DB
    for (const e of calRes.data || []) {
      events.push(e);
    }

    // Auto-generate events from litigation details
    const lit = litRes.data;
    if (lit) {
      if (lit.trial_date) events.push({ id: "lit-trial", subject: "Trial Date", event_type: "hearing", start_time: lit.trial_date + "T09:00:00", end_time: lit.trial_date + "T17:00:00", is_all_day: true, source: "litigation" });
      if (lit.mediation_date) events.push({ id: "lit-mediation", subject: "Mediation", event_type: "meeting", start_time: lit.mediation_date + "T09:00:00", end_time: lit.mediation_date + "T17:00:00", is_all_day: true, source: "litigation" });
      if (lit.discovery_deadline) events.push({ id: "lit-discovery", subject: "Discovery Deadline", event_type: "deadline", start_time: lit.discovery_deadline + "T17:00:00", end_time: lit.discovery_deadline + "T17:00:00", source: "litigation" });
    }

    // SOL deadline
    const caseData = caseRes.data;
    if (caseData?.statute_of_limitations) {
      events.push({ id: "sol", subject: "⚠️ Statute of Limitations", event_type: "sol", start_time: caseData.statute_of_limitations + "T00:00:00", end_time: caseData.statute_of_limitations + "T23:59:59", is_all_day: true, source: "case" });
    }

    // Tasks with due dates
    for (const t of taskRes.data || []) {
      if (t.status === "completed" || t.status === "cancelled") continue;
      events.push({ id: `task-${t.id}`, subject: t.title, event_type: "deadline", start_time: t.due_date + "T17:00:00", end_time: t.due_date + "T17:00:00", source: "task", priority: t.priority });
    }

    // Discovery set deadlines
    for (const d of discRes.data || []) {
      if (d.status === "completed") continue;
      events.push({ id: `disc-${d.id}`, subject: `${d.type || "Discovery"}: ${d.title || "Response Due"}`, event_type: "deadline", start_time: d.due_date + "T17:00:00", end_time: d.due_date + "T17:00:00", source: "discovery" });
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
