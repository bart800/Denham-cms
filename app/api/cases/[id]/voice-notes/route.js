import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("case_notes")
    .select("*, author:team_members!case_notes_author_id_fkey(id, name, initials, color)")
    .eq("case_id", id)
    .eq("note_type", "voice")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}

export async function POST(request, { params }) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  const authorId = formData.get("author_id");

  if (!audioFile) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  // Transcribe with OpenAI Whisper
  let transcription;
  try {
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "recording.webm");
    whisperForm.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error("Whisper error:", err);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const result = await whisperRes.json();
    transcription = result.text;
  } catch (err) {
    console.error("Whisper request failed:", err);
    return NextResponse.json({ error: "Transcription request failed" }, { status: 500 });
  }

  // Save to case_notes
  const insert = {
    case_id: id,
    content: transcription,
    note_type: "voice",
  };
  if (authorId) insert.author_id = authorId;

  const { data, error } = await supabaseAdmin
    .from("case_notes")
    .insert(insert)
    .select("*, author:team_members!case_notes_author_id_fkey(id, name, initials, color)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabaseAdmin.from("activity_log").insert({
    case_id: id,
    type: "note",
    actor_name: data.author?.name || "System",
    actor_initials: data.author?.initials || "SYS",
    actor_color: data.author?.color || "#888",
    title: "Voice note added",
    description: transcription.substring(0, 200),
    date: new Date().toISOString().split("T")[0],
  }).catch(() => {});

  return NextResponse.json({ note: data, transcription }, { status: 201 });
}
