import { NextResponse } from "next/server";

const MATON_BASE = "https://gateway.maton.ai/outlook/v1.0";
const CLIENT_STATE_SECRET = process.env.OUTLOOK_WEBHOOK_SECRET || "denham-cms-webhook-secret";

// Microsoft Graph message subscriptions expire after 3 days max.
// This needs periodic renewal — consider a cron job every 2 days.

// GET — list active subscriptions
export async function GET() {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });
  }

  const res = await fetch(`${MATON_BASE}/subscriptions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Failed to list subscriptions: ${res.status}`, detail: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

// POST — create or renew a subscription
export async function POST() {
  const apiKey = process.env.MATON_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://denham-cms.vercel.app";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });
  }

  // Expiration: 3 days from now (max for message resources)
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 3);

  const subscriptionBody = {
    changeType: "created",
    notificationUrl: `${baseUrl}/api/webhooks/outlook`,
    resource: "me/messages",
    expirationDateTime: expiration.toISOString(),
    clientState: CLIENT_STATE_SECRET,
  };

  const res = await fetch(`${MATON_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscriptionBody),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Failed to create subscription: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const subscription = await res.json();

  // NOTE: Store subscription.id if you need to renew (PATCH) instead of recreating.
  // Subscription ID: subscription.id
  // Expires: subscription.expirationDateTime
  // Renew before expiry with PATCH /subscriptions/{id} with new expirationDateTime.

  return NextResponse.json({
    success: true,
    subscriptionId: subscription.id,
    expirationDateTime: subscription.expirationDateTime,
    notificationUrl: subscriptionBody.notificationUrl,
  });
}
