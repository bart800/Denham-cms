import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

// Pluggable SMS provider interface
const providers = {
  twilio: async ({ to, message }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("SMS_NOT_CONFIGURED");
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: message }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return { sid: data.sid, status: data.status };
  },
};

const SMS_PROVIDER = process.env.SMS_PROVIDER || "twilio";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { to, message, userId, userName } = await request.json();

    if (!to || !message) {
      return NextResponse.json({ error: "to and message are required" }, { status: 400 });
    }

    let twilioSid = null;
    let status = "sent";

    const provider = providers[SMS_PROVIDER];
    if (!provider) {
      return NextResponse.json({ error: `Unknown SMS provider: ${SMS_PROVIDER}` }, { status: 500 });
    }

    try {
      const result = await provider({ to, message });
      twilioSid = result.sid;
      status = result.status || "sent";
    } catch (err) {
      if (err.message === "SMS_NOT_CONFIGURED") {
        return NextResponse.json({ error: "SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER." }, { status: 503 });
      }
      throw err;
    }

    // Save to case_sms
    const { data: saved, error: saveErr } = await db.from("case_sms").insert({
      case_id: id,
      direction: "outbound",
      phone_number: to,
      message,
      status,
      twilio_sid: twilioSid,
      sent_by: userName || userId || "System",
    }).select().single();

    if (saveErr) console.error("Failed to save SMS record:", saveErr);

    // Log to activity
    await db.from("activity_log").insert({
      case_id: id,
      type: "note",
      description: `SMS sent to ${to}: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`,
      user_name: userName || "System",
      date: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true, smsId: saved?.id, status });
  } catch (err) {
    console.error("POST /api/cases/[id]/send-sms error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
