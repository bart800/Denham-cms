import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("liens")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from("liens")
    .insert({
      case_id: id,
      holder_name: body.holder_name,
      holder_type: body.holder_type || "other",
      amount: body.amount || 0,
      negotiated_amount: body.negotiated_amount,
      status: body.status || "pending",
      contact_info: body.contact_info,
      payoff_date: body.payoff_date,
      notes: body.notes,
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
  const { lien_id, ...updates } = body;
  if (!lien_id) return NextResponse.json({ error: "lien_id required" }, { status: 400 });

  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("liens")
    .update(updates)
    .eq("id", lien_id)
    .eq("case_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const lienId = searchParams.get("lien_id");
  if (!lienId) return NextResponse.json({ error: "lien_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("liens")
    .delete()
    .eq("id", lienId)
    .eq("case_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
