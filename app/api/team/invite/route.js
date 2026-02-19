import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { sendEmail } from "../../../../lib/send-email";
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

    // Send invite email via Microsoft Graph
    let emailSent = false;
    try {
      await sendEmail({
        to: email.toLowerCase(),
        subject: "You're invited to join Denham Law CMS",
        htmlBody: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1a1a2e; margin: 0 0 8px; font-size: 24px;">Welcome to Denham Law</h1>
              <p style="color: #666; margin: 0; font-size: 15px;">You've been invited to join as <strong>${role}</strong></p>
            </div>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
              <p style="color: #444; margin: 0 0 20px; font-size: 14px;">Click below to set up your account, upload your profile photo, and connect your Microsoft 365.</p>
              <a href="${inviteLink}" style="display: inline-block; padding: 14px 36px; background: #ebb003; color: #000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Complete Your Setup</a>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center;">This invite expires in 72 hours. If you didn't expect this, ignore this email.</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (e) {
      console.warn("Email send failed, invite link still valid:", e.message);
    }

    return NextResponse.json({ invite: data, link: inviteLink, emailSent });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
