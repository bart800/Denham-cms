import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function GET(request) {
  // Validate token and return invite details
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const { data: invite, error } = await db
      .from("team_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await db.from("team_invites").update({ status: "expired" }).eq("id", invite.id);
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    return NextResponse.json({ invite: { email: invite.email, role: invite.role } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { token, name, phone, password, profile_picture_url, bar_number } = await request.json();
    if (!token || !name || !password) {
      return NextResponse.json({ error: "Token, name, and password are required" }, { status: 400 });
    }

    // Validate invite
    const { data: invite, error: invErr } = await db
      .from("team_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invErr || !invite) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await db.from("team_invites").update({ status: "expired" }).eq("id", invite.id);
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    // Create or get existing Supabase Auth user
    let authUserId;
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      // If user already exists, find them and update password
      if (authErr.message?.includes("already been registered") || authErr.status === 422) {
        const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
        const existing = users?.find(u => u.email?.toLowerCase() === invite.email.toLowerCase());
        if (!existing) throw new Error("User exists in auth but could not be found");
        // Update their password
        await db.auth.admin.updateUserById(existing.id, { password });
        authUserId = existing.id;
      } else {
        throw authErr;
      }
    } else {
      authUserId = authUser.user.id;
    }

    // Generate initials
    const parts = name.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();

    // Generate color
    const colors = ["#4f8cff", "#7eb87e", "#e8a838", "#e06c75", "#c678dd", "#56b6c2", "#d19a66"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Create or update team_members row
    const { data: existingMember } = await db.from("team_members").select("id").eq("email", invite.email).single();
    
    let member;
    if (existingMember) {
      // Update existing team member
      const { data: updated, error: upErr } = await db.from("team_members")
        .update({ name, phone: phone || null, bar_number: bar_number || null, profile_picture_url: profile_picture_url || null, initials, color, auth_user_id: authUserId, onboarded_at: new Date().toISOString() })
        .eq("id", existingMember.id).select().single();
      if (upErr) throw upErr;
      member = updated;
    } else {
      const { data: created, error: memErr } = await db.from("team_members")
        .insert({ name, email: invite.email, role: invite.role, title: invite.role, phone: phone || null, bar_number: bar_number || null, profile_picture_url: profile_picture_url || null, initials, color, auth_user_id: authUserId, onboarded_at: new Date().toISOString() })
        .select().single();
      if (memErr) throw memErr;
      member = created;
    }

    // Mark invite as accepted
    await db.from("team_invites").update({
      status: "accepted",
      updated_at: new Date().toISOString(),
    }).eq("id", invite.id);

    return NextResponse.json({ success: true, member });
  } catch (err) {
    console.error("Onboard error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
