import { sendEmail } from "@/lib/send-email";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin;

// POST: Send email notification to a team member
// Body: { to_member_id, subject, htmlBody } OR { to_email, subject, htmlBody }
export async function POST(request) {
  try {
    const { to_member_id, to_email, subject, htmlBody } = await request.json();

    let email = to_email;

    // Resolve member email if member_id provided
    if (to_member_id && !email) {
      const { data: member } = await db
        .from("team_members")
        .select("id, name, email, notification_preferences")
        .eq("id", to_member_id)
        .single();

      if (!member?.email) {
        return NextResponse.json({ error: "Member not found or no email" }, { status: 404 });
      }

      // Check notification preferences
      const prefs = member.notification_preferences || {};
      if (prefs.email_enabled === false) {
        return NextResponse.json({ skipped: true, reason: "Email notifications disabled" });
      }

      email = member.email;
    }

    if (!email || !subject) {
      return NextResponse.json({ error: "email and subject required" }, { status: 400 });
    }

    await sendEmail({ to: email, subject, htmlBody: htmlBody || "" });

    return NextResponse.json({ sent: true, to: email });
  } catch (err) {
    console.error("Email notification error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
