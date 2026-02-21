import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MATON_API_KEY = process.env.MATON_API_KEY;
const MATON_URL = "https://gateway.maton.ai/outlook/v1.0/me/sendMail";

export async function POST(request) {
  try {
    const { case_ids, subject, body, user_name } = await request.json();

    if (!case_ids?.length || !subject || !body) {
      return NextResponse.json({ error: "case_ids, subject, and body are required" }, { status: 400 });
    }

    if (!MATON_API_KEY) {
      return NextResponse.json({ error: "MATON_API_KEY not configured" }, { status: 500 });
    }

    // Fetch cases with client emails
    const { data: cases, error } = await supabaseAdmin
      .from("cases")
      .select("id, client_name, client_email")
      .in("id", case_ids);

    if (error) throw error;

    const results = { success: [], failed: [], skipped: [] };

    for (const c of cases || []) {
      if (!c.client_email) {
        results.skipped.push({ id: c.id, client: c.client_name, reason: "No email on file" });
        continue;
      }

      try {
        // Replace template variables
        const personalizedBody = body
          .replace(/\{client_name\}/gi, c.client_name || "Client")
          .replace(/\{case_id\}/gi, c.id);
        const personalizedSubject = subject
          .replace(/\{client_name\}/gi, c.client_name || "Client");

        const resp = await fetch(MATON_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${MATON_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              subject: personalizedSubject,
              body: { contentType: "HTML", content: personalizedBody },
              toRecipients: [{ emailAddress: { address: c.client_email, name: c.client_name } }],
            },
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
        }

        // Log
        await supabaseAdmin.from("case_emails").insert({
          case_id: c.id,
          subject: personalizedSubject,
          direction: "outbound",
          from_address: "firm@denhamlaw.com",
          to_address: c.client_email,
          sent_at: new Date().toISOString(),
        }).catch(() => {});

        results.success.push({ id: c.id, client: c.client_name, email: c.client_email });
      } catch (err) {
        results.failed.push({ id: c.id, client: c.client_name, error: err.message });
      }
    }

    return NextResponse.json({
      message: `Sent ${results.success.length} emails, ${results.failed.length} failed, ${results.skipped.length} skipped`,
      ...results,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
