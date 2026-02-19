import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET() {
  try {
    // Fetch all active cases with attorney info
    const { data: cases, error } = await db.from("cases")
      .select("id, client_name, case_ref, status, assigned_attorney, date_opened, date_of_loss, jurisdiction, loss_type, settlement_amount, created_at")
      .not("status", "eq", "Closed")
      .order("assigned_attorney", { ascending: true });
    if (error) throw error;

    // Fetch upcoming deadlines
    const { data: deadlines } = await db.from("court_deadlines")
      .select("id, case_id, title, due_date, deadline_type")
      .eq("completed", false)
      .gte("due_date", new Date().toISOString())
      .order("due_date", { ascending: true })
      .limit(200);

    // Fetch upcoming reminders
    const { data: reminders } = await db.from("case_reminders")
      .select("id, case_id, message, due_date, reminder_type")
      .eq("completed", false)
      .gte("due_date", new Date().toISOString())
      .order("due_date", { ascending: true })
      .limit(200);

    // Fetch settled cases for performance metrics
    const { data: settled } = await db.from("cases")
      .select("id, assigned_attorney, settlement_amount, date_opened, status, created_at")
      .in("status", ["Settled", "Closed"]);

    // Group by attorney
    const attorneys = {};
    for (const c of cases || []) {
      const atty = c.assigned_attorney || "Unassigned";
      if (!attorneys[atty]) {
        attorneys[atty] = { name: atty, cases: [], phases: {}, totalAge: 0, deadlines: [], reminders: [] };
      }
      const age = Math.floor((Date.now() - new Date(c.date_opened || c.created_at)) / (1000*60*60*24));
      attorneys[atty].cases.push({ ...c, age });
      attorneys[atty].totalAge += age;
      const phase = c.status || "Unknown";
      attorneys[atty].phases[phase] = (attorneys[atty].phases[phase] || 0) + 1;
    }

    // Attach deadlines/reminders
    for (const d of deadlines || []) {
      const c = (cases || []).find(x => x.id === d.case_id);
      const atty = c?.assigned_attorney || "Unassigned";
      if (attorneys[atty]) attorneys[atty].deadlines.push(d);
    }
    for (const r of reminders || []) {
      const c = (cases || []).find(x => x.id === r.case_id);
      const atty = c?.assigned_attorney || "Unassigned";
      if (attorneys[atty]) attorneys[atty].reminders.push(r);
    }

    // Performance metrics from settled cases
    const performance = {};
    for (const s of settled || []) {
      const atty = s.assigned_attorney || "Unassigned";
      if (!performance[atty]) performance[atty] = { settled: 0, totalSettlement: 0, totalDays: 0 };
      performance[atty].settled++;
      performance[atty].totalSettlement += Number(s.settlement_amount) || 0;
      const days = Math.floor((Date.now() - new Date(s.date_opened || s.created_at)) / (1000*60*60*24));
      performance[atty].totalDays += days;
    }

    const result = Object.values(attorneys).map(a => ({
      name: a.name,
      activeCases: a.cases.length,
      avgAge: a.cases.length > 0 ? Math.round(a.totalAge / a.cases.length) : 0,
      phases: a.phases,
      cases: a.cases,
      upcomingDeadlines: a.deadlines.slice(0, 10),
      upcomingReminders: a.reminders.slice(0, 10),
      performance: performance[a.name] ? {
        settledCount: performance[a.name].settled,
        totalRecovery: performance[a.name].totalSettlement,
        avgDaysToSettle: performance[a.name].settled > 0 ? Math.round(performance[a.name].totalDays / performance[a.name].settled) : 0,
      } : { settledCount: 0, totalRecovery: 0, avgDaysToSettle: 0 },
    }));

    return NextResponse.json({ attorneys: result });
  } catch (err) {
    return NextResponse.json({ attorneys: [], error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { caseId, newAttorney } = await request.json();
    if (!caseId || !newAttorney) return NextResponse.json({ error: "Missing caseId or newAttorney" }, { status: 400 });

    const { data, error } = await db.from("cases").update({ assigned_attorney: newAttorney }).eq("id", caseId).select().single();
    if (error) throw error;
    return NextResponse.json({ case: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
