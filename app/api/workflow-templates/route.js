import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const phase = searchParams.get("phase");
  const case_type = searchParams.get("case_type");

  let query = db.from("workflow_templates").select("*");
  if (phase) query = query.eq("phase", phase);
  if (case_type) query = query.eq("case_type", case_type);
  query = query.order("case_type").order("phase").order("task_order");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const { data, error } = await db.from("workflow_templates").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
