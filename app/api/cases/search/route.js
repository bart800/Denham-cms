import { supabaseAdmin, supabase } from "../../../../lib/supabase";

export async function GET(request) {
  const db = supabaseAdmin || supabase;
  if (!db) return Response.json({ error: "No database connection" }, { status: 500 });

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const insurer = searchParams.get("insurer");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const solDays = searchParams.get("sol_days");
    const attorneyId = searchParams.get("attorney_id");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    // For text search, use RPC for relevance ranking
    if (q) {
      // Build filter conditions for the RPC fallback — use ilike across multiple columns
      let query = db
        .from("cases")
        .select(
          `id, ref, client_name, status, type, insurer, claim_number, policy_number,
           date_opened, statute_of_limitations, jurisdiction, date_of_loss,
           attorney:team_members!cases_attorney_id_fkey(id, name, initials, color),
           support:team_members!cases_support_id_fkey(id, name, initials, color)`,
          { count: "exact" }
        )
        .or(
          `client_name.ilike.%${q}%,insurer.ilike.%${q}%,claim_number.ilike.%${q}%,policy_number.ilike.%${q}%,ref.ilike.%${q}%,status.ilike.%${q}%,jurisdiction.ilike.%${q}%`
        );

      // Apply additional filters on top of text search
      if (insurer) query = query.ilike("insurer", `%${insurer}%`);
      if (status) query = query.eq("status", status);
      if (type) query = query.eq("type", type);
      if (attorneyId) query = query.eq("attorney_id", attorneyId);
      if (solDays) {
        const today = new Date().toISOString().split("T")[0];
        const future = new Date(Date.now() + parseInt(solDays, 10) * 86400000).toISOString().split("T")[0];
        query = query.gte("statute_of_limitations", today).lte("statute_of_limitations", future);
      }

      query = query.range(offset, offset + limit - 1).order("date_opened", { ascending: false });

      const { data, error, count } = await query;
      if (error) return Response.json({ error: error.message }, { status: 500 });

      return Response.json({
        data: data || [],
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      });
    }

    // No text search — filters only
    let query = db
      .from("cases")
      .select(
        `id, ref, client_name, status, type, insurer, claim_number, policy_number,
         date_opened, statute_of_limitations, jurisdiction, date_of_loss,
         attorney:team_members!cases_attorney_id_fkey(id, name, initials, color),
         support:team_members!cases_support_id_fkey(id, name, initials, color)`,
        { count: "exact" }
      );

    if (insurer) query = query.ilike("insurer", `%${insurer}%`);
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    if (attorneyId) query = query.eq("attorney_id", attorneyId);
    if (solDays) {
      const today = new Date().toISOString().split("T")[0];
      const future = new Date(Date.now() + parseInt(solDays, 10) * 86400000).toISOString().split("T")[0];
      query = query.gte("statute_of_limitations", today).lte("statute_of_limitations", future);
    }

    query = query.range(offset, offset + limit - 1).order("date_opened", { ascending: false });

    const { data, error, count } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
