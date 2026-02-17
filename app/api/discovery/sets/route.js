import { supabaseAdmin } from "../../../../lib/supabase";
import { supabase as supabaseAnon } from "../../../../lib/supabase";

const db = () => supabaseAdmin || supabaseAnon;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get("case_id");
  if (!caseId) return Response.json({ error: "case_id required" }, { status: 400 });
  const { data, error } = await db()
    .from("discovery_sets")
    .select("*, discovery_items(id)")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const sets = (data || []).map(s => ({ ...s, item_count: (s.discovery_items || []).length, discovery_items: undefined }));
  return Response.json(sets);
}

export async function POST(req) {
  const body = await req.json();
  const { case_id, type, direction, title, served_date, due_date, response_date, status, notes } = body;
  if (!case_id || !type || !direction || !title) return Response.json({ error: "Missing required fields" }, { status: 400 });
  const { data, error } = await db()
    .from("discovery_sets")
    .insert({ case_id, type, direction, title, served_date: served_date || null, due_date: due_date || null, response_date: response_date || null, status: status || "Pending", notes: notes || null })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
