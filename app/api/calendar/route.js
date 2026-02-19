import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const supabase = supabaseAdmin;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const start = searchParams.get("start") || startOfMonth.toISOString();
    const end = searchParams.get("end") || endOfMonth.toISOString();
    const forceRefresh = searchParams.get("refresh") === "true";

    // Try cached events first (from calendar_events table if it exists)
    if (supabase && !forceRefresh) {
      try {
        const { data: cached, error } = await supabase
          .from("calendar_events")
          .select("*")
          .gte("start_time", start)
          .lte("start_time", end)
          .order("start_time", { ascending: true });

        if (!error && cached && cached.length > 0) {
          // Return cached events mapped to expected format
          const events = cached.map(e => ({
            id: e.outlook_id || e.id,
            subject: e.subject,
            start: e.start_json ? JSON.parse(e.start_json) : { dateTime: e.start_time },
            end: e.end_json ? JSON.parse(e.end_json) : { dateTime: e.end_time },
            location: e.location || null,
            bodyPreview: e.body_preview || null,
            isAllDay: e.is_all_day || false,
            caseId: e.case_id || null,
            caseName: e.case_name || null,
          }));
          return NextResponse.json(events);
        }
      } catch (cacheErr) {
        // Table might not exist, fall through to live fetch
        console.log("Cache miss or table doesn't exist, fetching live");
      }
    }

    // Live fetch from Outlook
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

    // Match events to cases (batch lookup instead of N*M loop)
    if (supabase) {
      const { data: cases } = await supabase.from("cases").select("id, client_name");
      if (cases && cases.length > 0) {
        // Build a map of name parts -> case for faster matching
        const nameMap = new Map();
        for (const c of cases) {
          if (!c.client_name) continue;
          const parts = c.client_name.toLowerCase().split(/[\s,]+/).filter(p => p.length > 2);
          for (const part of parts) {
            if (!nameMap.has(part)) nameMap.set(part, []);
            nameMap.get(part).push(c);
          }
        }

        for (const event of events) {
          const words = (event.subject || "").toLowerCase().split(/[\s,\-:]+/).filter(w => w.length > 2);
          for (const word of words) {
            const matches = nameMap.get(word);
            if (matches && matches.length === 1) {
              event.caseId = matches[0].id;
              event.caseName = matches[0].client_name;
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
