import { supabaseAdmin, supabase } from "../../../lib/supabase";

export async function GET(request) {
  const db = supabaseAdmin || supabase;
  if (!db) return Response.json({ error: "No database connection" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const case_id = searchParams.get("case_id");
  const user_id = searchParams.get("user_id");
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    let query = db
      .from("activity_log")
      .select("*, cases:case_id(id, client_name, ref), team_members:user_id(id, name)", { count: "exact" });

    if (case_id) query = query.eq("case_id", case_id);
    if (user_id) query = query.eq("user_id", user_id);
    if (type) query = query.eq("type", type);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return Response.json({ data: data || [], total: count || 0 });
  } catch (err) {
    console.error("Activity API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
