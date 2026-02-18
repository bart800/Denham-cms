import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

export async function GET(request, { params }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "DB not configured" }, { status: 500 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    let query = supabaseAdmin
      .from("case_calls")
      .select("*")
      .eq("case_id", id)
      .order("started_at", { ascending: false });

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(
        `transcript.ilike.${pattern},ai_summary.ilike.${pattern},caller_name.ilike.${pattern},callee_name.ilike.${pattern}`
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (e) {
    console.error("[case-calls] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
