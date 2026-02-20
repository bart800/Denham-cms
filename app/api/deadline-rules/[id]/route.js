import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  const { id } = await params;
  const { data, error } = await db.from("deadline_rules").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  delete body.id; delete body.created_at;
  const { data, error } = await db.from("deadline_rules").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { error } = await db.from("deadline_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
