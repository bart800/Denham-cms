import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const isMet = body.is_met !== false; // default true

    const update = {
      is_met: isMet,
      met_at: isMet ? new Date().toISOString() : null,
      met_by: body.user_id || null,
    };

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
