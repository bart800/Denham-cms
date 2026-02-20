import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
const db = supabaseAdmin || supabase;

export async function POST(request, { params }) {
  try {
    const { id, taskId } = await params;
    const { member_id } = await request.json();

    const { data, error } = await db
      .from("case_tasks")
      .update({ assigned_to: member_id || null, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("case_id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
