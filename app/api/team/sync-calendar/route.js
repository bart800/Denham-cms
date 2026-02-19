import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MATON_GATEWAY = "https://gateway.maton.ai/outlook/v1.0";

// POST — sync calendar events for connected team members
export async function POST(request) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing MATON_API_KEY" }, { status: 500 });

  let body = {};
  try { body = await request.json(); } catch {}
  const targetMemberId = body.memberId || null;

  let query = supabaseAdmin.from("team_members").select("id, name, email, maton_connection_id")
    .eq("microsoft_connected", true).not("maton_connection_id", "is", null);
  if (targetMemberId) query = query.eq("id", targetMemberId);
  const { data: members } = await query;

  const results = [];
  for (const m of (members || [])) {
    let synced = 0, errors = 0;
    // Fetch future events + last 30 days
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString();
    const endDate = new Date(Date.now() + 365 * 86400000).toISOString();

    try {
      const res = await fetch(
        `${MATON_GATEWAY}/me/calendarview?startDateTime=${startDate}&endDateTime=${endDate}&$top=500&$select=id,subject,start,end,location,bodyPreview,organizer,attendees,isAllDay,isCancelled`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Maton-Connection": m.maton_connection_id,
            Prefer: 'outlook.timezone="Eastern Standard Time"',
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        results.push({ member: m.name, error: text });
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
      errors++;
    }

    results.push({ member: m.name, email: m.email, synced, errors });
  }

  return NextResponse.json({ results });
}
