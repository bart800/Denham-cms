import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("case_id", caseId)
    .order("datetime", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      case_id: body.caseId,
      datetime: body.datetime,
      type: body.type || "consultation",
      duration_min: body.duration_min || 30,
      status: "scheduled",
      notes: body.notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
