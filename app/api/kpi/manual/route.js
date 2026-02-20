import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
const db = supabaseAdmin || supabase;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start");
    const memberId = searchParams.get("member_id");

    let q = db.from("kpi_actuals").select("*");
    if (weekStart) q = q.eq("week_start", weekStart);
    if (memberId) q = q.eq("member_id", memberId);
    else q = q.is("member_id", null);

    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entries: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { metric, week_start, actual_value, member_id, notes } = body;

    if (!metric || !week_start || actual_value === undefined) {
      return NextResponse.json({ error: "metric, week_start, and actual_value required" }, { status: 400 });
    }

    const { data, error } = await db.from("kpi_actuals").upsert({
      metric,
      week_start,
      actual_value: Number(actual_value),
      member_id: member_id || null,
      notes: notes || null,
    }, { onConflict: "metric,week_start,member_id" }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entry: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
