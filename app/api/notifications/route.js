import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM";

const supabase = createClient(supabaseUrl, supabaseKey);

// Send email via SendGrid or Resend
async function sendEmail({ to, subject, body, html }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (sendgridKey) {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sendgridKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.FROM_EMAIL || "noreply@denham.law", name: "Denham Law" },
        subject,
        content: [{ type: html ? "text/html" : "text/plain", value: html || body }],
      }),
    });
    if (!resp.ok) throw new Error(`SendGrid error: ${resp.status}`);
    return { provider: "sendgrid", status: "sent" };
  }

  if (resendKey) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "noreply@denham.law",
        to, subject, html: html || body,
      }),
    });
    if (!resp.ok) throw new Error(`Resend error: ${resp.status}`);
    return { provider: "resend", status: "sent" };
  }

  return { provider: "none", status: "skipped", message: "No email provider configured (set SENDGRID_API_KEY or RESEND_API_KEY)" };
}

// Send SMS via Twilio
async function sendSMS({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return { provider: "none", status: "skipped", message: "Twilio not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)" };
  }

  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Twilio error: ${err.message || resp.status}`);
  }
  const data = await resp.json();
  return { provider: "twilio", status: "sent", sid: data.sid };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("case_id");
  const userId = searchParams.get("user_id");
  const limit = parseInt(searchParams.get("limit") || "50");

  let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (caseId) q = q.eq("case_id", caseId);
  if (userId) q = q.eq("user_id", userId);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ notifications: data });
}

export async function POST(request) {
  try {
    const { channel, to, subject, body, html, case_id, user_id, type } = await request.json();

    let result;
    if (channel === "email") {
      result = await sendEmail({ to, subject, body, html });
    } else if (channel === "sms") {
      result = await sendSMS({ to, body });
    } else {
      result = { provider: "system", status: "logged" };
    }

    // Log notification
    const { data, error } = await supabase.from("notifications").insert({
      case_id: case_id || null,
      user_id: user_id || null,
      type: type || "general",
      channel: channel || "system",
      recipient: to || null,
      subject: subject || null,
      body: body || null,
      status: result.status,
      provider: result.provider,
      metadata: result,
    }).select().single();

    if (error) console.error("Failed to log notification:", error);

    return Response.json({ result, notification: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
