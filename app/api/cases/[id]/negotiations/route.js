import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("negotiations")
    .select("*")
    .eq("case_id", id)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await request.json();
  const { type, amount, date, notes } = body;

  if (!type || !amount || !date) {
    return NextResponse.json({ error: "type, amount, and date are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("negotiations")
    .insert({ case_id: id, type, amount, date, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
