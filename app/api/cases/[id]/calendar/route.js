import { NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("case_id", id)
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
