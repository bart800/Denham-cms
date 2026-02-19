import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("case_expenses")
    .select("*")
    .eq("case_id", id)
    .order("date_incurred", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from("case_expenses")
    .insert({
      case_id: id,
      description: body.description,
      amount: body.amount || 0,
      category: body.category || "other",
      date_incurred: body.date_incurred,
      paid_by: body.paid_by || "firm",
      receipt_path: body.receipt_path,
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
  const { expense_id, ...updates } = body;
  if (!expense_id) return NextResponse.json({ error: "expense_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("case_expenses")
    .update(updates)
    .eq("id", expense_id)
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
  const expenseId = searchParams.get("expense_id");
  if (!expenseId) return NextResponse.json({ error: "expense_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("case_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("case_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
