import { supabaseAdmin } from "@/lib/supabase";
import { getM365Token } from "@/lib/m365-graph";
import { NextResponse } from "next/server";

const MATON_GATEWAY = "https://gateway.maton.ai/outlook/v1.0";
const GRAPH_API = "https://graph.microsoft.com/v1.0";

// POST — sync calendar events for connected team members
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const targetMemberId = body.memberId || null;

  // Resolve members with auth method
  let members = [];
  if (targetMemberId) {
    const { data: tokenRow } = await supabaseAdmin.from("m365_tokens")
      .select("team_member_id").eq("team_member_id", targetMemberId).single();
    const { data: member } = await supabaseAdmin.from("team_members")
      .select("id, name, email, maton_connection_id").eq("id", targetMemberId).single();
    if (member) members.push({ ...member, auth_method: tokenRow ? "m365_direct" : "maton" });
  } else {
    const { data: tokenMembers } = await supabaseAdmin.from("m365_tokens").select("team_member_id");
    const m365Ids = (tokenMembers || []).map(t => t.team_member_id);
    if (m365Ids.length > 0) {
      const { data: dm } = await supabaseAdmin.from("team_members").select("id, name, email, maton_connection_id").in("id", m365Ids);
      for (const m of (dm || [])) members.push({ ...m, auth_method: "m365_direct" });
    }
    const { data: mm } = await supabaseAdmin.from("team_members").select("id, name, email, maton_connection_id")
      .eq("microsoft_connected", true).not("maton_connection_id", "is", null);
    for (const m of (mm || [])) {
      if (!m365Ids.includes(m.id)) members.push({ ...m, auth_method: "maton" });
    }
  }

  if (!members.length) return NextResponse.json({ error: "No connected members found" }, { status: 404 });

  const apiKey = process.env.MATON_API_KEY;
  const startDate = new Date(Date.now() - 30 * 86400000).toISOString();
  const endDate = new Date(Date.now() + 365 * 86400000).toISOString();
  const calQuery = `?startDateTime=${startDate}&endDateTime=${endDate}&$top=500&$select=id,subject,start,end,location,bodyPreview,organizer,attendees,isAllDay,isCancelled`;

  const results = [];
  for (const m of members) {
    let synced = 0, errors = 0;

    try {
      let url, headers;
      if (m.auth_method === "m365_direct") {
        const token = await getM365Token(m.id);
        if (!token) { results.push({ member: m.name, error: "Failed to get M365 token" }); continue; }
        url = `${GRAPH_API}/me/calendarview${calQuery}`;
        headers = { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="Eastern Standard Time"' };
      } else {
        if (!apiKey) { results.push({ member: m.name, error: "Missing MATON_API_KEY" }); continue; }
        url = `${MATON_GATEWAY}/me/calendarview${calQuery}`;
        headers = { Authorization: `Bearer ${apiKey}`, "Maton-Connection": m.maton_connection_id, Prefer: 'outlook.timezone="Eastern Standard Time"' };
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        results.push({ member: m.name, error: text.slice(0, 300) });
        continue;
      }

      const data = await res.json();
      for (const evt of (data.value || [])) {
        if (evt.isCancelled) continue;
        const row = {
          outlook_event_id: evt.id,
          team_member_id: m.id,
          subject: (evt.subject || "").slice(0, 500),
          start_time: evt.start?.dateTime,
          end_time: evt.end?.dateTime,
          timezone: evt.start?.timeZone || "Eastern Standard Time",
          location: evt.location?.displayName || null,
          body_preview: (evt.bodyPreview || "").slice(0, 2000),
          is_all_day: evt.isAllDay || false,
          organizer_email: evt.organizer?.emailAddress?.address || null,
          attendees: JSON.stringify((evt.attendees || []).map(a => a.emailAddress?.address).filter(Boolean)),
          synced_from: m.email,
        };
        const { error } = await supabaseAdmin
          .from("calendar_events")
          .upsert(row, { onConflict: "outlook_event_id", ignoreDuplicates: false });
        if (error) errors++;
        else synced++;
      }
    } catch (err) {
      console.error(`[sync-calendar] ${m.name} error:`, err.message);
      errors++;
    }

    results.push({ member: m.name, email: m.email, synced, errors, auth: m.auth_method });
  }

  return NextResponse.json({ results });
}
