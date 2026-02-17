import { supabaseAdmin } from "../../../../lib/supabase";
import { supabase as supabaseAnon } from "../../../../lib/supabase";

const db = () => supabaseAdmin || supabaseAnon;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const setId = searchParams.get("set_id");
  if (!setId) return Response.json({ error: "set_id required" }, { status: 400 });
  const { data, error } = await db()
    .from("discovery_items")
    .select("*")
    .eq("set_id", setId)
    .order("item_number", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}

export async function POST(req) {
  const body = await req.json();
  const { id, set_id, item_number, request_text, response_text, status, objection_text, notes } = body;
  if (id) {
    const { data, error } = await db().from("discovery_items").update({ request_text, response_text, status, objection_text, notes }).eq("id", id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }
  if (!set_id || !item_number) return Response.json({ error: "set_id and item_number required" }, { status: 400 });
  const { data, error } = await db().from("discovery_items").insert({ set_id, item_number, request_text: request_text || null, response_text: response_text || null, status: status || "Pending", objection_text: objection_text || null, notes: notes || null }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
