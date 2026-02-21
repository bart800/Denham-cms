import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { data, error } = await db
      .from("case_sms")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ sms: data || [] });
  } catch (err) {
    console.error("GET /api/cases/[id]/sms error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
