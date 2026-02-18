import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function GET() {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: "Not configured" }, { status: 500 });

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .select("*, cases(id, client_name)")
      .in("event_type", ["deadline", "sol", "hearing", "deposition"])
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(100);

    if (error) throw error;

    const deadlines = (data || []).map(e => {
      const startDate = new Date(e.start_time);
      const diffMs = startDate - new Date();
      const daysRemaining = Math.ceil(diffMs / 86400000);
      return {
        ...e,
        days_remaining: daysRemaining,
        urgency: daysRemaining <= 3 ? "critical" : daysRemaining <= 7 ? "high" : daysRemaining <= 14 ? "medium" : "low",
      };
    });

    return NextResponse.json(deadlines);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
