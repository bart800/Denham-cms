import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // filter: note, status_change, negotiation, milestone, document

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    // Fetch all three sources in parallel
    const [activityRes, negotiationsRes, caseRes] = await Promise.all([
      supabaseAdmin
        .from("activity_log")
        .select("*")
        .eq("case_id", id)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("negotiations")
        .select("*")
        .eq("case_id", id)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("cases")
        .select("client_name, date_opened, date_of_loss, statute_of_limitations")
        .eq("id", id)
        .single(),
    ]);

    if (activityRes.error) throw activityRes.error;
    if (negotiationsRes.error) throw negotiationsRes.error;
    if (caseRes.error) throw caseRes.error;

    const events = [];

    // 1. Activity log entries
    for (const a of activityRes.data || []) {
      events.push({
        id: `activity-${a.id}`,
        type: a.type || "note",
        date: a.date || a.created_at,
        description: a.description,
        actor: a.actor_name || a.actor || null,
        source: "activity_log",
      });
    }

    // 2. Negotiations → timeline events
    for (const n of negotiationsRes.data || []) {
      const isDemand = n.type === "demand";
      const amount = Number(n.amount).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
      events.push({
        id: `negotiation-${n.id}`,
        type: "negotiation",
        date: n.date || n.created_at,
        description: isDemand ? `Demand sent ${amount}` : `Offer received ${amount}`,
        actor: n.notes || null,
        source: "negotiations",
      });
    }

    // 3. Case milestones
    const c = caseRes.data;
    if (c) {
      if (c.date_opened) {
        events.push({
          id: "milestone-opened",
          type: "milestone",
          date: c.date_opened,
          description: "Case opened",
          actor: null,
          source: "case",
        });
      }
      if (c.date_of_loss) {
        events.push({
          id: "milestone-loss",
          type: "milestone",
          date: c.date_of_loss,
          description: "Date of loss",
          actor: null,
          source: "case",
        });
      }
      if (c.statute_of_limitations) {
        events.push({
          id: "milestone-sol",
          type: "milestone",
          date: c.statute_of_limitations,
          description: "Statute of limitations",
          actor: null,
          source: "case",
        });
      }
    }

    // Sort newest first
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter by type if requested
    const filtered = type ? events.filter((e) => e.type === type) : events;

    return NextResponse.json({ timeline: filtered, total: filtered.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
