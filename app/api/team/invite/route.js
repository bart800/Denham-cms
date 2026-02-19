import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import crypto from "crypto";

export async function POST(request) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { email, role, invited_by } = await request.json();
    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    // Check for existing pending invite
    const { data: existing } = await db
      .from("team_invites")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single();

    if (existing) {
      return NextResponse.json({ error: "A pending invite already exists for this email" }, { status: 409 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from("team_invites")
      .insert({
        email: email.toLowerCase(),
        role,
        invited_by: invited_by || null,
        token,
        expires_at,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://denham-cms.vercel.app";
    const inviteLink = `${baseUrl}/onboard?token=${token}`;

    return NextResponse.json({ invite: data, link: inviteLink });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
