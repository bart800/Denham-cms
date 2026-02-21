import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

async function getM365Token(userId) {
  // Try to find M365 token for the user
  const { data } = await db
    .from("m365_tokens")
    .select("access_token, refresh_token, expires_at, email")
    .eq("team_member_id", userId)
    .single();
  if (!data) return null;
  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    // Token expired — try refresh
    try {
      const refreshRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID || "",
          client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
          refresh_token: data.refresh_token,
          grant_type: "refresh_token",
          scope: "Mail.Send Mail.ReadWrite",
        }),
      });
      if (refreshRes.ok) {
        const tokens = await refreshRes.json();
        await db.from("m365_tokens").update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || data.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }).eq("team_member_id", userId);
        return { token: tokens.access_token, email: data.email };
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }
    return null;
  }
  return { token: data.access_token, email: data.email };
}

async function sendViaGraph(token, { to, cc, bcc, subject, body }) {
  const toRecipients = to.split(",").map(e => ({ emailAddress: { address: e.trim() } }));
  const ccRecipients = cc ? cc.split(",").map(e => ({ emailAddress: { address: e.trim() } })) : [];
  const bccRecipients = bcc ? bcc.split(",").map(e => ({ emailAddress: { address: e.trim() } })) : [];

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: body },
        toRecipients,
        ccRecipients,
        bccRecipients,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error ${res.status}: ${err}`);
  }
}

async function sendViaMaton({ to, cc, bcc, subject, body }) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) throw new Error("No MATON_API_KEY configured");

  const toRecipients = to.split(",").map(e => ({ emailAddress: { address: e.trim() } }));
  const ccRecipients = cc ? cc.split(",").map(e => ({ emailAddress: { address: e.trim() } })) : [];
  const bccRecipients = bcc ? bcc.split(",").map(e => ({ emailAddress: { address: e.trim() } })) : [];

  const res = await fetch("https://gateway.maton.ai/outlook/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: body },
        toRecipients,
        ccRecipients,
        bccRecipients,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Maton API error ${res.status}: ${err}`);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { to, cc, bcc, subject, body: emailBody, userId, userName } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
    }

    let sentVia = "unknown";
    let fromEmail = null;

    // Try M365 token first
    if (userId) {
      const m365 = await getM365Token(userId);
      if (m365) {
        await sendViaGraph(m365.token, { to, cc, bcc, subject, body: emailBody });
        sentVia = "m365";
        fromEmail = m365.email;
      }
    }

    // Fallback to Maton proxy
    if (sentVia === "unknown") {
      try {
        await sendViaMaton({ to, cc, bcc, subject, body: emailBody });
        sentVia = "maton";
      } catch (matonErr) {
        return NextResponse.json({ error: `Failed to send email: ${matonErr.message}` }, { status: 500 });
      }
    }

    // Save to case_emails
    const { data: saved, error: saveErr } = await db.from("case_emails").insert({
      case_id: id,
      subject,
      from_address: fromEmail || userName || "CMS",
      to_address: to,
      cc_address: cc || null,
      body_text: emailBody.replace(/<[^>]+>/g, ""),
      body_html: emailBody,
      direction: "outbound",
      received_at: new Date().toISOString(),
      read: true,
    }).select().single();

    if (saveErr) console.error("Failed to save email record:", saveErr);

    // Log to activity
    await db.from("activity_log").insert({
      case_id: id,
      type: "email",
      description: `Outbound email sent to ${to}: "${subject}"`,
      user_name: userName || "System",
      date: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true, sentVia, emailId: saved?.id });
  } catch (err) {
    console.error("POST /api/cases/[id]/send-email error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
