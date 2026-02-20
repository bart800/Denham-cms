import { supabaseAdmin, supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET() {
  try {
    const { data, error } = await db.from("team_members").select("id, name, email, role, status, profile_picture_url, m365_user_id, onboarding_completed_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ members: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { memberId, ...updates } = body;
    if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

    const allowed = ["onboarding_completed_at"];
    const filtered = {};
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key];
    }
    if (Object.keys(filtered).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

    const { error } = await db.from("team_members").update(filtered).eq("id", memberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
