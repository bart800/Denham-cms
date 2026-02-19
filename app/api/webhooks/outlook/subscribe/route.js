import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const MATON_GATEWAY = "https://gateway.maton.ai/outlook/v1.0";
const CLIENT_STATE_SECRET = process.env.OUTLOOK_WEBHOOK_SECRET || "denham-cms-webhook-secret";

// GET — list active subscriptions across all connected team members
export async function GET() {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });

  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name, email, maton_connection_id")
    .not("maton_connection_id", "is", null);

  const results = [];
  for (const m of (members || [])) {
    const res = await fetch(`${MATON_GATEWAY}/subscriptions`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Maton-Connection": m.maton_connection_id,
      },
    });
    if (res.ok) {
      const data = await res.json();
      results.push({ member: m.name, email: m.email, subscriptions: data.value || [] });
    }
  }

  return NextResponse.json({ results });
}

// POST — create/renew subscriptions for all connected team members (or a specific one)
export async function POST(request) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://denham-cms.vercel.app");

  let body = {};
  try { body = await request.json(); } catch {}
  const targetMemberId = body.memberId || null;

  // Get connected team members
  let query = supabaseAdmin.from("team_members").select("id, name, email, maton_connection_id").eq("microsoft_connected", true).not("maton_connection_id", "is", null);
  if (targetMemberId) query = query.eq("id", targetMemberId);
  const { data: members } = await query;

  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 3);

  const results = [];
  for (const m of (members || [])) {
    try {
      const res = await fetch(`${MATON_GATEWAY}/subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Maton-Connection": m.maton_connection_id,
        },
        body: JSON.stringify({
          changeType: "created",
          notificationUrl: `${baseUrl}/api/webhooks/outlook`,
          resource: "me/messages",
          expirationDateTime: expiration.toISOString(),
          clientState: CLIENT_STATE_SECRET,
        }),
      });

      if (res.ok) {
        const sub = await res.json();
        results.push({ member: m.name, success: true, subscriptionId: sub.id });
      } else {
        const text = await res.text();
        results.push({ member: m.name, success: false, error: text });
      }
    } catch (err) {
      results.push({ member: m.name, success: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
