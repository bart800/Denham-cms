import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MATON_GATEWAY = "https://gateway.maton.ai/outlook/v1.0";
const FIRM_DOMAIN = "denham.law";

// POST — sync historical emails for a team member (or all connected members)
export async function POST(request) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });

  let body = {};
  try { body = await request.json(); } catch {}
  const targetMemberId = body.memberId || null;
  const maxPages = body.maxPages || 50; // safety limit

  // Get connected team members
  let query = supabaseAdmin.from("team_members").select("id, name, email, maton_connection_id")
    .eq("microsoft_connected", true).not("maton_connection_id", "is", null);
  if (targetMemberId) query = query.eq("id", targetMemberId);
  const { data: members } = await query;

  // Load cases for matching
  const { data: cases } = await supabaseAdmin.from("cases").select("id, client_name, client_email, claim_number");

  const results = [];
  for (const m of (members || [])) {
    let synced = 0, skipped = 0, errors = 0;
    let nextLink = `${MATON_GATEWAY}/me/messages?$top=50&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments&$orderby=receivedDateTime desc`;
    let pages = 0;

    while (nextLink && pages < maxPages) {
      try {
        const res = await fetch(nextLink, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Maton-Connection": m.maton_connection_id,
          },
        });

        if (!res.ok) {
          errors++;
          break;
        }

        const data = await res.json();
        const messages = data.value || [];

        for (const msg of messages) {
          const fromEmail = (msg.from?.emailAddress?.address || "").toLowerCase();
          const toAddrs = (msg.toRecipients || []).map(r => r.emailAddress?.address).filter(Boolean);
          const ccAddrs = (msg.ccRecipients || []).map(r => r.emailAddress?.address).filter(Boolean);
          const direction = fromEmail.endsWith(`@${FIRM_DOMAIN}`) ? "outbound" : "inbound";

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
            synced_from: m.email,
          };

          const { error } = await supabaseAdmin
            .from("case_emails")
            .upsert(row, { onConflict: "message_id", ignoreDuplicates: true });

          if (error) errors++;
          else synced++;
        }

        nextLink = data["@odata.nextLink"] || null;
        pages++;
      } catch (err) {
        errors++;
        break;
      }
    }

    results.push({ member: m.name, email: m.email, synced, skipped, errors, pages });
  }

  return NextResponse.json({ results });
}

function matchCase(msg, cases) {
  const addrs = getAllAddresses(msg);
  const subject = (msg.subject || "").toLowerCase();

  for (const c of cases) {
    if (c.client_email && addrs.includes(c.client_email.toLowerCase())) {
      return { matchedCase: c, matchedBy: "email" };
    }
  }
  for (const c of cases) {
    if (c.client_name && c.client_name.length > 3 && subject.includes(c.client_name.toLowerCase())) {
      return { matchedCase: c, matchedBy: "name" };
    }
  }
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
  for (const r of msg.toRecipients || []) if (r.emailAddress?.address) addrs.push(r.emailAddress.address.toLowerCase());
  for (const r of msg.ccRecipients || []) if (r.emailAddress?.address) addrs.push(r.emailAddress.address.toLowerCase());
  return addrs;
}
