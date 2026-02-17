import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = supabaseAdmin || supabase;
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const now = new Date();
  const alerts = [];

  try {
    // --- SOL alerts (critical < 30 days, warning < 90 days) ---
    const in90 = new Date(now);
    in90.setDate(in90.getDate() + 90);

    const { data: solCases, error: solErr } = await db
      .from("cases")
      .select("id, case_name, statute_of_limitations")
      .not("statute_of_limitations", "is", null)
      .lte("statute_of_limitations", in90.toISOString().split("T")[0])
      .gte("statute_of_limitations", now.toISOString().split("T")[0]);

    if (!solErr && solCases) {
      for (const c of solCases) {
        const solDate = new Date(c.statute_of_limitations);
        const daysLeft = Math.ceil((solDate - now) / (1000 * 60 * 60 * 24));
        const isCritical = daysLeft < 30;

        alerts.push({
          id: `sol-${c.id}`,
          type: "sol",
          severity: isCritical ? "critical" : "warning",
          title: isCritical ? "SOL Imminent" : "SOL Approaching",
          description: `${c.case_name} — SOL in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} (${c.statute_of_limitations})`,
          case_id: c.id,
          case_name: c.case_name,
          created_at: now.toISOString(),
        });
      }
    }

    // --- Litigation cases without discovery deadlines ---
    const { data: litCases, error: litErr } = await db
      .from("cases")
      .select("id, case_name, case_phase, discovery_deadline")
      .eq("case_phase", "Litigation")
      .is("discovery_deadline", null);

    if (!litErr && litCases) {
      for (const c of litCases) {
        alerts.push({
          id: `disc-${c.id}`,
          type: "compliance",
          severity: "warning",
          title: "Missing Discovery Deadline",
          description: `${c.case_name} is in litigation but has no discovery deadline set.`,
          case_id: c.id,
          case_name: c.case_name,
          created_at: now.toISOString(),
        });
      }
    }

    // --- Overdue tasks (gracefully skip if table doesn't exist) ---
    try {
      const { data: tasks, error: taskErr } = await db
        .from("case_tasks")
        .select("id, title, due_date, case_id, cases(case_name)")
        .eq("status", "pending")
        .lt("due_date", now.toISOString().split("T")[0]);

      if (!taskErr && tasks) {
        for (const t of tasks) {
          const daysOverdue = Math.ceil((now - new Date(t.due_date)) / (1000 * 60 * 60 * 24));
          alerts.push({
            id: `task-${t.id}`,
            type: "task",
            severity: daysOverdue > 7 ? "critical" : "warning",
            title: "Overdue Task",
            description: `"${t.title}" overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} — ${t.cases?.case_name || "Unknown case"}`,
            case_id: t.case_id,
            case_name: t.cases?.case_name || "Unknown",
            created_at: now.toISOString(),
          });
        }
      }
    } catch {
      // case_tasks table doesn't exist — skip silently
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  return NextResponse.json(alerts);
}
