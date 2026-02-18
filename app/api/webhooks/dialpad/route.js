import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function matchCase(supabase, callerNumber, calleeNumber, transcript, aiSummary) {
  // Strategy 1: Phone number match
  const phones = [callerNumber, calleeNumber].map(normalizePhone).filter(Boolean);
  if (phones.length) {
    const { data } = await supabase
      .from("cases")
      .select("id, client_name, claim_number, ref")
      .in("client_phone", phones)
      .limit(1);
    if (data?.length) return { case_id: data[0].id, matched_by: "phone", caseData: data[0] };
  }

  // Strategy 2 & 3: Text search against transcript then ai_summary
  const textSources = [
    { text: transcript, prefix: "transcript" },
    { text: aiSummary, prefix: "ai_summary" },
  ];

  for (const { text, prefix } of textSources) {
    if (!text) continue;
    const upper = text.toUpperCase();

    // Get cases to search against
    const { data: cases } = await supabase
      .from("cases")
      .select("id, client_name, claim_number, ref")
      .eq("status", "Open")
      .limit(500);
    if (!cases?.length) continue;

    for (const c of cases) {
      // Match client name (>3 chars)
      if (c.client_name && c.client_name.length > 3 && upper.includes(c.client_name.toUpperCase())) {
        return { case_id: c.id, matched_by: `${prefix}_name`, caseData: c };
      }
      // Match claim number
      if (c.claim_number && upper.includes(c.claim_number.toUpperCase())) {
        return { case_id: c.id, matched_by: `${prefix}_claim`, caseData: c };
      }
      // Match case ref
      if (c.ref && upper.includes(c.ref.toUpperCase())) {
        return { case_id: c.id, matched_by: `${prefix}_ref`, caseData: c };
      }
    }
  }

  return { case_id: null, matched_by: null, caseData: null };
}

async function fetchTranscriptAsync(callId, recordId) {
  const apiKey = process.env.DIALPAD_API_KEY;
  if (!apiKey || !callId) return;
  try {
    const res = await fetch(
      `https://dialpad.com/api/v2/calls/${callId}/transcript?apikey=${apiKey}`
    );
    if (!res.ok) return;
    const data = await res.json();
    const transcript = typeof data === "string" ? data : data.transcript || JSON.stringify(data);
    if (transcript && supabaseAdmin) {
      await supabaseAdmin
        .from("case_calls")
        .update({ transcript })
        .eq("call_id", String(callId));
    }
  } catch (e) {
    console.error("[dialpad-webhook] transcript fetch error:", e.message);
  }
}

export async function POST(request) {
  try {
    // Validate webhook secret (optional)
    const secret = process.env.DIALPAD_WEBHOOK_SECRET;
    if (secret) {
      const provided = request.headers.get("x-dialpad-secret") || 
                       request.headers.get("x-webhook-secret");
      if (provided !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "DB not configured" }, { status: 500 });
    }

    const body = await request.json();
    const event = body;

    // Extract call data from Dialpad webhook payload
    const callId = String(event.call_id || event.id || "");
    if (!callId) {
      return NextResponse.json({ error: "No call_id" }, { status: 400 });
    }

    const callerNumber = event.caller?.phone_number || event.from_number || event.caller_number || "";
    const calleeNumber = event.callee?.phone_number || event.to_number || event.callee_number || "";
    const transcript = event.transcript || event.transcription || null;
    const aiSummary = event.ai_summary || event.summary || event.ai?.summary || null;

    // Match to case
    const { case_id, matched_by, caseData } = await matchCase(
      supabaseAdmin, callerNumber, calleeNumber, transcript, aiSummary
    );

    if (caseData) {
      console.log(`[dialpad-webhook] Matched call ${callId} → case ${caseData.ref} (${caseData.client_name}) via ${matched_by}`);
    } else {
      console.log(`[dialpad-webhook] Call ${callId} unmatched`);
    }

    // Build record
    const startedAt = event.started_at || event.date_started || event.start_time || null;
    const endedAt = event.ended_at || event.date_ended || event.end_time || null;
    const ai = event.ai || {};

    const record = {
      case_id,
      call_id: callId,
      direction: event.direction || event.call_direction || null,
      category: event.category || event.call_type || null,
      duration_seconds: event.duration || event.duration_seconds || null,
      caller_name: event.caller?.name || event.caller_name || null,
      caller_email: event.caller?.email || event.caller_email || null,
      external_number: callerNumber || calleeNumber || null,
      internal_number: calleeNumber || callerNumber || null,
      date_started: startedAt ? new Date(typeof startedAt === "number" ? startedAt * 1000 : startedAt).toISOString() : null,
      date_ended: endedAt ? new Date(typeof endedAt === "number" ? endedAt * 1000 : endedAt).toISOString() : null,
      was_recorded: !!(event.recording_url || event.recording?.url),
      voicemail: !!(event.voicemail_url || event.voicemail?.url),
      target_type: event.target?.type || null,
      target_name: event.target?.name || event.callee?.name || null,
      ai_talk_pct: ai.talk_percentage ?? event.ai_talk_pct ?? null,
      ai_listen_pct: ai.listen_percentage ?? event.ai_listen_pct ?? null,
      ai_silent_pct: ai.silent_percentage ?? event.ai_silent_pct ?? null,
      transcript,
      ai_summary: aiSummary,
      ai_moments: ai.moments ? JSON.stringify(ai.moments) : event.ai_moments || null,
      notes: matched_by ? `Matched by: ${matched_by}` : null,
    };

    // Upsert by call_id
    const { error } = await supabaseAdmin
      .from("case_calls")
      .upsert(record, { onConflict: "call_id" });

    if (error) {
      console.error("[dialpad-webhook] upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Async transcript fetch if not included
    if (!transcript) {
      fetchTranscriptAsync(callId).catch(() => {});
    }

    return NextResponse.json({ ok: true, case_id, matched_by });
  } catch (e) {
    console.error("[dialpad-webhook] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
