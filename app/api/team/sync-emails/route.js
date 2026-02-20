import { supabaseAdmin } from "@/lib/supabase";
import { getM365Token } from "@/lib/m365-graph";
import { NextResponse } from "next/server";

const MATON_GATEWAY = "https://gateway.maton.ai/outlook/v1.0";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
const FIRM_DOMAIN = "denham.law";

// POST — sync historical emails for a team member (or all connected members)
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const targetMemberId = body.memberId || null;
  const maxPages = body.maxPages || 50;

  // Get team members — either those with M365 tokens OR Maton connections
  let members = [];

  if (targetMemberId) {
    // Check for direct M365 token first
    const { data: tokenRow } = await supabaseAdmin.from("m365_tokens")
      .select("team_member_id, email, display_name")
      .eq("team_member_id", targetMemberId)
      .single();

    if (tokenRow) {
      const { data: member } = await supabaseAdmin.from("team_members")
        .select("id, name, email, maton_connection_id")
        .eq("id", targetMemberId).single();
      if (member) members.push({ ...member, auth_method: "m365_direct" });
    } else {
      // Fall back to Maton
      const { data: member } = await supabaseAdmin.from("team_members")
        .select("id, name, email, maton_connection_id")
        .eq("id", targetMemberId)
        .eq("microsoft_connected", true)
        .not("maton_connection_id", "is", null)
        .single();
      if (member) members.push({ ...member, auth_method: "maton" });
    }
  } else {
    // Get all connected members — check M365 tokens first
    const { data: tokenMembers } = await supabaseAdmin.from("m365_tokens").select("team_member_id");
    const m365Ids = (tokenMembers || []).map(t => t.team_member_id);

    // Direct M365 members
    if (m365Ids.length > 0) {
      const { data: directMembers } = await supabaseAdmin.from("team_members")
        .select("id, name, email, maton_connection_id")
        .in("id", m365Ids);
      for (const m of (directMembers || [])) members.push({ ...m, auth_method: "m365_direct" });
    }

    // Maton members (that don't already have direct M365)
    const { data: matonMembers } = await supabaseAdmin.from("team_members")
      .select("id, name, email, maton_connection_id")
      .eq("microsoft_connected", true)
      .not("maton_connection_id", "is", null);
    for (const m of (matonMembers || [])) {
      if (!m365Ids.includes(m.id)) members.push({ ...m, auth_method: "maton" });
    }
  }

  if (!members.length) {
    return NextResponse.json({ error: "No connected members found" }, { status: 404 });
  }

  const cases = (await supabaseAdmin.from("cases").select("id, client_name, client_email, claim_number")).data || [];
  const apiKey = process.env.MATON_API_KEY;

  const results = [];
  for (const m of members) {
    let synced = 0, skipped = 0, errors = 0, pages = 0;

    // Build initial URL and headers based on auth method
    let nextLink, headers;
    if (m.auth_method === "m365_direct") {
      const token = await getM365Token(m.id);
      if (!token) {
        results.push({ member: m.name, email: m.email, error: "Failed to get M365 token" });
        continue;
      }
      nextLink = `${GRAPH_API}/me/messages?$top=50&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments&$orderby=receivedDateTime desc`;
      headers = { Authorization: `Bearer ${token}` };
    } else {
      if (!apiKey) {
        results.push({ member: m.name, email: m.email, error: "Missing MATON_API_KEY" });
        continue;
      }
      nextLink = `${MATON_GATEWAY}/me/messages?$top=50&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments&$orderby=receivedDateTime desc`;
      headers = { Authorization: `Bearer ${apiKey}`, "Maton-Connection": m.maton_connection_id };
    }

    while (nextLink && pages < maxPages) {
      try {
        // For direct M365, refresh token if we're past page 0 (long sync)
        if (m.auth_method === "m365_direct" && pages > 0 && pages % 10 === 0) {
          const freshToken = await getM365Token(m.id);
          if (freshToken) headers = { Authorization: `Bearer ${freshToken}` };
        }

        const res = await fetch(nextLink, { headers });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`[sync-emails] ${m.name} page ${pages} error:`, res.status, errText.slice(0, 200));
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
        console.error(`[sync-emails] ${m.name} exception:`, err.message);
        errors++;
        break;
      }
    }

    results.push({ member: m.name, email: m.email, synced, skipped, errors, pages, auth: m.auth_method });
  }

  return NextResponse.json({ results });
}

function matchCase(msg, cases) {
  const addrs = getAllAddresses(msg);
  const subject = (msg.subject || "").toLowerCase();
  for (const c of cases) {
    if (c.client_email && addrs.includes(c.client_email.toLowerCase())) return { matchedCase: c, matchedBy: "email" };
  }
  for (const c of cases) {
    if (c.client_name && c.client_name.length > 3 && subject.includes(c.client_name.toLowerCase())) return { matchedCase: c, matchedBy: "name" };
  }
  for (const c of cases) {
    if (c.claim_number && c.claim_number.length > 2 && subject.includes(c.claim_number.toLowerCase())) return { matchedCase: c, matchedBy: "claim_number" };
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
