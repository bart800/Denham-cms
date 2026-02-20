import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jurisdiction = searchParams.get("jurisdiction");

  let query = db.from("deadline_rules").select("*");
  if (jurisdiction) query = query.or(`jurisdiction.eq.${jurisdiction},jurisdiction.eq.ALL`);
  query = query.order("trigger_event").order("days");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const { data, error } = await db.from("deadline_rules").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
