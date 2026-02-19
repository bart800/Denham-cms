import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const { data, error } = await db.from("settlement_scenarios").select("*").eq("case_id", id).order("created_at", { ascending: false });
    if (error) throw error;

    // Compute derived fields since we don't have generated columns
    const scenarios = (data || []).map(s => {
      const pd = Number(s.property_damage) || 0;
      const dep = Number(s.depreciation) || 0;
      const ded = Number(s.deductible) || 0;
      const ale = Number(s.additional_living_expenses) || 0;
      const cu = Number(s.code_upgrades) || 0;
      const offer = Number(s.insurer_offer) || 0;
      const demand = Number(s.our_demand) || 0;
      const policy = Number(s.policy_limits) || 0;

      const rcv = pd + cu;
      const acv = rcv - dep;
      const holdback = dep;
      const netClaim = acv - ded + ale;
      const gap = demand - offer;
      const gapPct = demand > 0 ? ((gap / demand) * 100).toFixed(1) : 0;
      const policyExcess = netClaim > policy && policy > 0 ? netClaim - policy : 0;

      return { ...s, rcv, acv, holdback, netClaim, gap, gapPct, policyExcess };
    });

    return NextResponse.json({ scenarios });
  } catch (err) {
    return NextResponse.json({ scenarios: [], error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { data, error } = await db.from("settlement_scenarios").insert({
      case_id: id,
      name: body.name || "Scenario",
      property_damage: body.property_damage || 0,
      depreciation: body.depreciation || 0,
      deductible: body.deductible || 0,
      policy_limits: body.policy_limits || 0,
      additional_living_expenses: body.additional_living_expenses || 0,
      code_upgrades: body.code_upgrades || 0,
      insurer_offer: body.insurer_offer || 0,
      our_demand: body.our_demand || 0,
      notes: body.notes || null,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ scenario: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const scenarioId = body.id;
    if (!scenarioId) return NextResponse.json({ error: "Missing scenario id" }, { status: 400 });
    
    const updates = {};
    for (const k of ["name","property_damage","depreciation","deductible","policy_limits","additional_living_expenses","code_upgrades","insurer_offer","our_demand","notes"]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await db.from("settlement_scenarios").update(updates).eq("id", scenarioId).eq("case_id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ scenario: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId");
  if (!scenarioId) return NextResponse.json({ error: "Missing scenarioId" }, { status: 400 });
  try {
    const { error } = await db.from("settlement_scenarios").delete().eq("id", scenarioId).eq("case_id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
