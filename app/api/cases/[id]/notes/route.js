import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const pinnedOnly = searchParams.get("pinned") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let query = supabaseAdmin
    .from("case_notes")
    .select("*, author:team_members!case_notes_author_id_fkey(id, name, initials, color)", { count: "exact" })
    .eq("case_id", id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (pinnedOnly) {
    query = query.eq("pinned", true);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data, total: count, page, limit });
}

export async function POST(request, { params }) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, author_id, pinned } = body;

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const insert = {
    case_id: id,
    content: content.trim(),
    pinned: pinned || false,
  };
  if (author_id) insert.author_id = author_id;

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
    title: "Note added",
    description: content.trim().substring(0, 200),
    date: new Date().toISOString().split("T")[0],
  });

  return NextResponse.json(data, { status: 201 });
}
