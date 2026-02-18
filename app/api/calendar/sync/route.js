import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

function categorizeEvent(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("deadline")) return "deadline";
  if (s.includes("hearing")) return "hearing";
  if (s.includes("deposition")) return "deposition";
  if (s.includes("sol") || s.includes("statute of limitation")) return "sol";
  if (s.includes("mediation") || s.includes("meeting")) return "meeting";
  return "other";
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "supabaseAdmin not configured (missing SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
    }

    const apiKey = process.env.MATON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "MATON_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const start = body.start || now.toISOString();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 365);
    const end = body.end || endDate.toISOString();

    // Fetch events from Outlook
    const url = `https://gateway.maton.ai/outlook/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$orderby=start/dateTime&$top=500`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Outlook API error", details: text }, { status: res.status });
    }

    const data = await res.json();
    const outlookEvents = data.value || [];

    // Load cases for matching
    const { data: cases } = await supabaseAdmin.from("cases").select("id, client_name");
    const caseList = cases || [];

    let inserted = 0;
    let updated = 0;
    let matched = 0;

    for (const e of outlookEvents) {
      const startTime = e.start?.dateTime ? new Date(e.start.dateTime + (e.start.timeZone === "UTC" ? "Z" : "")).toISOString() : null;
      const endTime = e.end?.dateTime ? new Date(e.end.dateTime + (e.end.timeZone === "UTC" ? "Z" : "")).toISOString() : null;
      if (!startTime || !endTime) continue;

      // Match to case
      let caseId = null;
      let matchedBy = null;
      const subjectLower = (e.subject || "").toLowerCase();
      for (const c of caseList) {
        if (!c.client_name) continue;
        const nameParts = c.client_name.toLowerCase().split(/\s+/);
        const matchPart = nameParts.find((part) => part.length > 2 && subjectLower.includes(part));
        if (matchPart) {
          caseId = c.id;
          matchedBy = `client_name part "${matchPart}" found in subject`;
          matched++;
          break;
        }
      }

      const record = {
        outlook_id: e.id,
        subject: e.subject || "(No subject)",
        body_preview: e.bodyPreview || null,
        start_time: startTime,
        end_time: endTime,
        location: e.location?.displayName || null,
        is_all_day: e.isAllDay || false,
        event_type: categorizeEvent(e.subject),
        case_id: caseId,
        matched_by: matchedBy,
      };

      const { data: existing } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("outlook_id", e.id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from("calendar_events").update(record).eq("id", existing.id);
        updated++;
      } else {
        await supabaseAdmin.from("calendar_events").insert(record);
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: outlookEvents.length,
        inserted,
        updated,
        matched,
        dateRange: { start, end },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
