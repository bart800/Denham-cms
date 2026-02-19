import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET() {
  try {
    // Fetch all active cases with attorney info
    const { data: cases, error } = await db.from("cases")
      .select(`id, client_name, ref, status, date_opened, date_of_loss, jurisdiction, type, 
               settlement_amount, created_at, attorney_id,
               attorney:team_members!cases_attorney_id_fkey(id, name, initials, color)`)
      .not("status", "eq", "Closed")
      .order("date_opened", { ascending: false });
    if (error) throw error;

    // Fetch settled cases for performance metrics
    const { data: settled } = await db.from("cases")
      .select(`id, settlement_amount, date_opened, status, created_at, attorney_id,
               attorney:team_members!cases_attorney_id_fkey(id, name)`)
      .in("status", ["Settled", "Closed"]);

    // Group by attorney
    const attorneys = {};
    for (const c of cases || []) {
      const attyName = c.attorney?.name || "Unassigned";
      const attyId = c.attorney_id || "unassigned";
      if (!attorneys[attyId]) {
        attorneys[attyId] = { 
          id: attyId, name: attyName, 
          initials: c.attorney?.initials || "?", color: c.attorney?.color || "#888",
          cases: [], phases: {}, totalAge: 0 
        };
      }
      const age = Math.floor((Date.now() - new Date(c.date_opened || c.created_at)) / (1000*60*60*24));
      attorneys[attyId].cases.push({ 
        id: c.id, client_name: c.client_name, ref: c.ref, status: c.status, 
        jurisdiction: c.jurisdiction, type: c.type, age,
        settlement_amount: Number(c.settlement_amount) || 0
      });
      attorneys[attyId].totalAge += age;
      const phase = c.status || "Unknown";
      attorneys[attyId].phases[phase] = (attorneys[attyId].phases[phase] || 0) + 1;
    }

    // Performance metrics from settled cases
    const performance = {};
    for (const s of settled || []) {
      const attyId = s.attorney_id || "unassigned";
      if (!performance[attyId]) performance[attyId] = { settled: 0, totalSettlement: 0, totalDays: 0 };
      performance[attyId].settled++;
      performance[attyId].totalSettlement += Number(s.settlement_amount) || 0;
      const days = Math.floor((Date.now() - new Date(s.date_opened || s.created_at)) / (1000*60*60*24));
      performance[attyId].totalDays += days;
    }

    const result = Object.values(attorneys).map(a => ({
      id: a.id,
      name: a.name,
      initials: a.initials,
      color: a.color,
      activeCases: a.cases.length,
      avgAge: a.cases.length > 0 ? Math.round(a.totalAge / a.cases.length) : 0,
      phases: a.phases,
      cases: a.cases,
      performance: performance[a.id] ? {
        settledCount: performance[a.id].settled,
        totalRecovery: performance[a.id].totalSettlement,
        avgDaysToSettle: performance[a.id].settled > 0 ? Math.round(performance[a.id].totalDays / performance[a.id].settled) : 0,
      } : { settledCount: 0, totalRecovery: 0, avgDaysToSettle: 0 },
    })).sort((a, b) => b.activeCases - a.activeCases);

    return NextResponse.json({ attorneys: result });
  } catch (err) {
    return NextResponse.json({ attorneys: [], error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { caseId, newAttorneyId } = await request.json();
    if (!caseId || !newAttorneyId) return NextResponse.json({ error: "Missing caseId or newAttorneyId" }, { status: 400 });

    const { data, error } = await db.from("cases").update({ attorney_id: newAttorneyId }).eq("id", caseId).select().single();
    if (error) throw error;
    return NextResponse.json({ case: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
