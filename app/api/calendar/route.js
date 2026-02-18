import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const start = searchParams.get("start") || startOfWeek.toISOString();
    const end = searchParams.get("end") || endOfWeek.toISOString();

    const apiKey = process.env.MATON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "MATON_API_KEY not configured" }, { status: 500 });
    }

    const url = `https://gateway.maton.ai/outlook/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$orderby=start/dateTime&$top=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Outlook API error", details: text }, { status: res.status });
    }

    const data = await res.json();
    const events = (data.value || []).map((e) => ({
      id: e.id,
      subject: e.subject,
      start: e.start,
      end: e.end,
      location: e.location?.displayName || null,
      bodyPreview: e.bodyPreview || null,
      isAllDay: e.isAllDay || false,
    }));

    // Try to match events to cases
    if (supabase) {
      const { data: cases } = await supabase.from("cases").select("id, client_name");
      if (cases && cases.length > 0) {
        for (const event of events) {
          const subjectLower = (event.subject || "").toLowerCase();
          for (const c of cases) {
            if (!c.client_name) continue;
            const nameParts = c.client_name.toLowerCase().split(/\s+/);
            const match = nameParts.some((part) => part.length > 2 && subjectLower.includes(part));
            if (match) {
              event.caseId = c.id;
              event.caseName = c.client_name;
              break;
            }
          }
        }
      }
    }

    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
