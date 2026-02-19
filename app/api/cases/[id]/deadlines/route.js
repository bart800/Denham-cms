import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

// Jurisdiction-based deadline rules (days from source event)
const JURISDICTION_RULES = {
  FL: [
    { type: "discovery_response", days: 30, label: "Response to Discovery (FL)" },
    { type: "motion_response", days: 20, label: "Response to Motion (FL)" },
    { type: "expert_disclosure", days: 90, label: "Expert Disclosure (FL)" },
  ],
  KY: [
    { type: "discovery_response", days: 30, label: "Response to Discovery (KY)" },
    { type: "motion_response", days: 21, label: "Response to Motion (KY)" },
    { type: "expert_disclosure", days: 60, label: "Expert Disclosure (KY)" },
  ],
  TN: [
    { type: "discovery_response", days: 30, label: "Response to Discovery (TN)" },
    { type: "motion_response", days: 15, label: "Response to Motion (TN)" },
    { type: "expert_disclosure", days: 60, label: "Expert Disclosure (TN)" },
  ],
  DEFAULT: [
    { type: "discovery_response", days: 30, label: "Response to Discovery" },
    { type: "motion_response", days: 21, label: "Response to Motion" },
    { type: "expert_disclosure", days: 90, label: "Expert Disclosure" },
  ],
};

function getUrgency(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { level: "overdue", color: "#e04050", daysLeft };
  if (daysLeft < 7) return { level: "critical", color: "#e04050", daysLeft };
  if (daysLeft < 30) return { level: "warning", color: "#ebb003", daysLeft };
  return { level: "ok", color: "#386f4a", daysLeft };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeCompleted = searchParams.get("completed") === "true";

  try {
    let query = db.from("court_deadlines").select("*").eq("case_id", id).order("due_date", { ascending: true });
    if (!includeCompleted) query = query.eq("completed", false);

    const { data, error } = await query;
    if (error) throw error;

    const deadlines = (data || []).map(d => ({
      ...d,
      urgency: getUrgency(d.due_date),
    }));

    return NextResponse.json({ deadlines, rules: JURISDICTION_RULES });
  } catch (err) {
    return NextResponse.json({ deadlines: [], error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();

    // If auto_calculate is set, generate deadlines from a source event
    if (body.auto_calculate && body.source_date) {
      const jurisdiction = body.jurisdiction || "DEFAULT";
      const rules = JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.DEFAULT;
      const sourceDate = new Date(body.source_date);
      const deadlines = [];

      for (const rule of rules) {
        const dueDate = new Date(sourceDate);
        dueDate.setDate(dueDate.getDate() + rule.days);
        deadlines.push({
          case_id: id, deadline_type: rule.type, title: rule.label,
          description: `Auto-calculated: ${rule.days} days from ${body.source_event || "event"} (${sourceDate.toLocaleDateString()})`,
          due_date: dueDate.toISOString(), jurisdiction,
          auto_calculated: true, source_event: body.source_event || null,
          source_date: body.source_date,
        });
      }

      const { data, error } = await db.from("court_deadlines").insert(deadlines).select();
      if (error) throw error;
      return NextResponse.json({ deadlines: data });
    }

    // Manual single deadline
    const { data, error } = await db.from("court_deadlines").insert({
      case_id: id,
      deadline_type: body.deadline_type || "custom",
      title: body.title,
      description: body.description || null,
      due_date: body.due_date,
      jurisdiction: body.jurisdiction || "FL",
      auto_calculated: false,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ deadline: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const deadlineId = body.id;
    if (!deadlineId) return NextResponse.json({ error: "Missing deadline id" }, { status: 400 });

    const updates = {};
    if (body.completed !== undefined) {
      updates.completed = body.completed;
      updates.completed_at = body.completed ? new Date().toISOString() : null;
    }
    for (const k of ["title","description","due_date","deadline_type","jurisdiction"]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const { data, error } = await db.from("court_deadlines").update(updates).eq("id", deadlineId).eq("case_id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ deadline: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const deadlineId = searchParams.get("deadlineId");
  if (!deadlineId) return NextResponse.json({ error: "Missing deadlineId" }, { status: 400 });
  try {
    const { error } = await db.from("court_deadlines").delete().eq("id", deadlineId).eq("case_id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
