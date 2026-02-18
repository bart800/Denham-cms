import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

const MATON_BASE = "https://gateway.maton.ai/outlook/v1.0";
const FIRM_DOMAIN = "denham.law";
const CLIENT_STATE_SECRET = process.env.OUTLOOK_WEBHOOK_SECRET || "denham-cms-webhook-secret";

// Microsoft Graph validation handshake (GET with validationToken)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Missing validationToken" }, { status: 400 });
}

// Receive webhook notifications
export async function POST(request) {
  const { searchParams } = new URL(request.url);

  // Validation handshake can also come as POST with query param
  const validationToken = searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Process notifications in background, respond 202 immediately
  const body = await request.json();
  const notifications = body?.value || [];

  // Fire-and-forget processing
  processNotifications(notifications).catch((err) =>
    console.error("[outlook-webhook] Error processing notifications:", err)
  );

  return new Response(null, { status: 202 });
}

async function processNotifications(notifications) {
  if (!supabaseAdmin) {
    console.error("[outlook-webhook] supabaseAdmin not configured");
    return;
  }

  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) {
    console.error("[outlook-webhook] Missing MATON_API_KEY");
    return;
  }

  // Load cases for matching
  const { data: cases, error: cErr } = await supabaseAdmin
    .from("cases")
    .select("id, client_name, client_email, claim_number");
  if (cErr) {
    console.error("[outlook-webhook] Failed to load cases:", cErr.message);
    return;
  }

  for (const notification of notifications) {
    // Verify clientState if set
    if (notification.clientState && notification.clientState !== CLIENT_STATE_SECRET) {
      console.warn("[outlook-webhook] Invalid clientState, skipping");
      continue;
    }

    const resource = notification.resource; // e.g. "me/messages/{id}"
    if (!resource) continue;

    try {
      const selectFields = "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments";
      const res = await fetch(
        `${MATON_BASE}/${resource}?%24select=${selectFields}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!res.ok) {
        console.error(`[outlook-webhook] Failed to fetch ${resource}: ${res.status}`);
        continue;
      }

      const msg = await res.json();
      const fromEmail = (msg.from?.emailAddress?.address || "").toLowerCase();
      const fromName = msg.from?.emailAddress?.name || "";
      const toAddrs = (msg.toRecipients || []).map((r) => r.emailAddress?.address).filter(Boolean);
      const ccAddrs = (msg.ccRecipients || []).map((r) => r.emailAddress?.address).filter(Boolean);
      const direction = fromEmail.endsWith(`@${FIRM_DOMAIN}`) ? "outbound" : "inbound";

      // Match to case
      const { matchedCase, matchedBy } = matchCase(msg, cases);

      const row = {
        case_id: matchedCase?.id || null,
        message_id: msg.id,
        subject: (msg.subject || "").slice(0, 500),
        from_address: fromEmail,
        to_address: toAddrs.join(", "),
        cc_address: ccAddrs.join(", "),
        direction,
        body_text: msg.body?.contentType === "text" ? (msg.body?.content || "").slice(0, 50000) : null,
        body_html: msg.body?.contentType === "html" ? (msg.body?.content || "").slice(0, 50000) : null,
        received_at: msg.receivedDateTime,
        has_attachments: msg.hasAttachments || false,
        matched_by: matchedBy,
      };

      const { error } = await supabaseAdmin
        .from("case_emails")
        .upsert(row, { onConflict: "message_id", ignoreDuplicates: false });

      if (error) {
        console.error(`[outlook-webhook] Upsert error for ${msg.id}:`, error.message);
      } else {
        console.log(`[outlook-webhook] Upserted email: ${msg.subject?.slice(0, 60)} → case ${matchedCase?.id || "unmatched"} (${matchedBy || "none"})`);
      }
    } catch (err) {
      console.error(`[outlook-webhook] Error processing ${resource}:`, err.message);
    }
  }
}

function matchCase(msg, cases) {
  const addrs = getAllAddresses(msg);
  const subject = (msg.subject || "").toLowerCase();

  // 1) Email match — sender/recipient matches client_email
  for (const c of cases) {
    if (c.client_email && addrs.includes(c.client_email.toLowerCase())) {
      return { matchedCase: c, matchedBy: "email" };
    }
  }

  // 2) Subject contains client name (>3 chars)
  for (const c of cases) {
    if (c.client_name && c.client_name.length > 3 && subject.includes(c.client_name.toLowerCase())) {
      return { matchedCase: c, matchedBy: "name" };
    }
  }

  // 3) Subject contains claim number
  for (const c of cases) {
    if (c.claim_number && c.claim_number.length > 2 && subject.includes(c.claim_number.toLowerCase())) {
      return { matchedCase: c, matchedBy: "claim_number" };
    }
  }

  return { matchedCase: null, matchedBy: null };
}

function getAllAddresses(msg) {
  const addrs = [];
  if (msg.from?.emailAddress?.address) addrs.push(msg.from.emailAddress.address.toLowerCase());
  for (const r of msg.toRecipients || []) {
    if (r.emailAddress?.address) addrs.push(r.emailAddress.address.toLowerCase());
  }
  for (const r of msg.ccRecipients || []) {
    if (r.emailAddress?.address) addrs.push(r.emailAddress.address.toLowerCase());
  }
  return addrs;
}
