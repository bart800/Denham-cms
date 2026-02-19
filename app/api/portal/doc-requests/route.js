import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("document_requests")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("document_requests")
    .insert({
      case_id: body.case_id,
      requested_by: body.requested_by || "firm",
      description: body.description,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
