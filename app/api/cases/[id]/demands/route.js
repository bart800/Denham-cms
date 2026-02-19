import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .select("*")
    .eq("case_id", id)
    .order("generated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();

  // Auto-increment version
  const { data: existing } = await supabaseAdmin
    .from("case_demands")
    .select("version")
    .eq("case_id", id)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (existing && existing.length > 0 ? existing[0].version : 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .insert({
      case_id: id,
      version: nextVersion,
      content_html: body.content_html || "",
      status: body.status || "draft",
      generated_at: body.generated_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { demand_id, ...updates } = body;
  if (!demand_id) return NextResponse.json({ error: "demand_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("case_demands")
    .update(updates)
    .eq("id", demand_id)
    .eq("case_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
