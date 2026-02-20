import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
const db = supabaseAdmin || supabase;

export async function GET() {
  try {
    const { data, error } = await db
      .from("team_members")
      .select("id, name, email, title, role")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ members: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
