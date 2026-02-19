import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeCompleted = searchParams.get("completed") === "true";

  try {
    let query = db.from("case_reminders").select("*").eq("case_id", id).order("due_date", { ascending: true });
    if (!includeCompleted) query = query.eq("completed", false);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ reminders: data || [] });
  } catch (err) {
    return NextResponse.json({ reminders: [], error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();

    // Auto-detect stale cases
    if (body.auto_detect) {
      const { data: activity } = await db.from("activity_log").select("date").eq("case_id", id).order("date", { ascending: false }).limit(1);
      const lastActivity = activity?.[0]?.date;
      const daysSince = lastActivity ? Math.floor((Date.now() - new Date(lastActivity)) / (1000*60*60*24)) : 999;

      if (daysSince >= 30) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3); // reminder in 3 days
        const { data, error } = await db.from("case_reminders").insert({
          case_id: id, reminder_type: "stale_case",
          message: `No activity in ${daysSince} days. Follow up needed.`,
          due_date: dueDate.toISOString(), auto_generated: true,
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ reminder: data, stale: true, daysSince });
      }
      return NextResponse.json({ stale: false, daysSince });
    }

    const { data, error } = await db.from("case_reminders").insert({
      case_id: id,
      reminder_type: body.reminder_type || "general",
      message: body.message,
      due_date: body.due_date,
      created_by: body.created_by || null,
      auto_generated: false,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ reminder: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const reminderId = body.id;
    if (!reminderId) return NextResponse.json({ error: "Missing reminder id" }, { status: 400 });

    const updates = {};
    if (body.completed !== undefined) {
      updates.completed = body.completed;
      updates.completed_at = body.completed ? new Date().toISOString() : null;
    }
    for (const k of ["message","due_date","reminder_type"]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const { data, error } = await db.from("case_reminders").update(updates).eq("id", reminderId).eq("case_id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ reminder: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const reminderId = searchParams.get("reminderId");
  if (!reminderId) return NextResponse.json({ error: "Missing reminderId" }, { status: 400 });
  try {
    const { error } = await db.from("case_reminders").delete().eq("id", reminderId).eq("case_id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
