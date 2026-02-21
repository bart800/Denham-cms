import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin;

// Default staleness thresholds (days)
const STALE_DAYS = {
  presuit: 14,
  litigation: 30,
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const presuitDays = parseInt(searchParams.get("presuit_days") || STALE_DAYS.presuit);
    const litigationDays = parseInt(searchParams.get("litigation_days") || STALE_DAYS.litigation);

    const now = new Date();
    const presuitCutoff = new Date(now - presuitDays * 86400000).toISOString();
    const litigationCutoff = new Date(now - litigationDays * 86400000).toISOString();

    // Get all active cases
    const { data: cases, error } = await db
      .from("cases")
      .select("id, ref, client_name, status, type, attorney_id, updated_at, date_opened")
      .not("status", "in", '("Closed","Settled","Referred")');

    if (error) throw error;

    // For each case, check last activity
    const staleCases = [];

    for (const c of cases || []) {
      const isLitigation = (c.status || "").toLowerCase().includes("litigation");
      const cutoff = isLitigation ? litigationCutoff : presuitCutoff;
      const thresholdDays = isLitigation ? litigationDays : presuitDays;

      // Check latest task completion
      const { data: lastTask } = await db
        .from("case_tasks")
        .select("updated_at")
        .eq("case_id", c.id)
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(1);

      // Check latest email
      const { data: lastEmail } = await db
        .from("case_emails")
        .select("date")
        .eq("case_id", c.id)
        .order("date", { ascending: false })
        .limit(1);

      // Check latest note
      const { data: lastNote } = await db
        .from("case_notes")
        .select("created_at")
        .eq("case_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // Find most recent activity date
      const dates = [
        lastTask?.[0]?.updated_at,
        lastEmail?.[0]?.date,
        lastNote?.[0]?.created_at,
        c.updated_at,
      ].filter(Boolean).map(d => new Date(d));

      const lastActivity = dates.length ? new Date(Math.max(...dates)) : new Date(c.date_opened || c.updated_at);
      const daysSinceActivity = Math.floor((now - lastActivity) / 86400000);

      if (lastActivity.toISOString() < cutoff) {
        staleCases.push({
          id: c.id,
          ref: c.ref,
          client_name: c.client_name,
          status: c.status,
          type: c.type,
          attorney_id: c.attorney_id,
          last_activity: lastActivity.toISOString(),
          days_since_activity: daysSinceActivity,
          threshold_days: thresholdDays,
        });
      }
    }

    // Sort by days since activity (most stale first)
    staleCases.sort((a, b) => b.days_since_activity - a.days_since_activity);

    return NextResponse.json({
      stale_cases: staleCases,
      count: staleCases.length,
      thresholds: { presuit: presuitDays, litigation: litigationDays },
    });
  } catch (err) {
    console.error("Stale cases error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
