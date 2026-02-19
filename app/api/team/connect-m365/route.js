import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MATON_BASE = "https://ctrl.maton.ai";

// POST — create a new Maton connection for a team member, return OAuth URL
export async function POST(request) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });

  const { memberId } = await request.json();
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  // Create Maton connection
  const res = await fetch(`${MATON_BASE}/connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app: "outlook" }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Failed to create Maton connection", detail: text }, { status: res.status });
  }

  const createData = await res.json();
  const connectionId = createData.connection_id || createData.connection?.connection_id;

  // Fetch the connection to get the OAuth URL
  const getRes = await fetch(`${MATON_BASE}/connections/${connectionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const getData = await getRes.json();
  const oauthUrl = getData.connection?.url || getData.url;

  // Store connection_id on team member (pending until OAuth completes)
  await supabaseAdmin.from("team_members").update({
    maton_connection_id: connectionId,
    microsoft_connected: false,
  }).eq("id", memberId);

  return NextResponse.json({ connectionId, oauthUrl });
}

// GET — check connection status for a team member
export async function GET(request) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  // Get stored connection_id
  const { data: member } = await supabaseAdmin.from("team_members").select("maton_connection_id").eq("id", memberId).single();
  if (!member?.maton_connection_id) return NextResponse.json({ connected: false, reason: "no_connection" });

  // Check Maton connection status
  const res = await fetch(`${MATON_BASE}/connections/${member.maton_connection_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) return NextResponse.json({ connected: false, reason: "connection_not_found" });

  const data = await res.json();
  const connection = data.connection || data;
  const isActive = connection.status === "ACTIVE";

  // Update team_members if newly active
  if (isActive) {
    await supabaseAdmin.from("team_members").update({ microsoft_connected: true }).eq("id", memberId);
  }

  return NextResponse.json({ connected: isActive, status: connection.status });
}
