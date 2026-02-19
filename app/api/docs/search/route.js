import { supabaseAdmin, supabase } from "../../../../lib/supabase";

export async function GET(request) {
  const db = supabaseAdmin || supabase;
  if (!db) return Response.json({ error: "No database connection" }, { status: 500 });

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const caseId = searchParams.get("case_id");
    const category = searchParams.get("category");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const offset = (page - 1) * limit;

    let query = db
      .from("documents")
      .select(`
        id, filename, original_path, category, mime_type, size_bytes, 
        created_at, case_id, ai_summary, ai_category,
        case:cases!documents_case_id_fkey(id, ref, client_name)
      `, { count: "exact" });

    if (q) {
      query = query.or(
        `filename.ilike.%${q}%,original_path.ilike.%${q}%,category.ilike.%${q}%,ai_summary.ilike.%${q}%,ai_category.ilike.%${q}%`
      );
    }

    if (caseId) query = query.eq("case_id", caseId);
    if (category) query = query.ilike("category", `%${category}%`);

    query = query
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      documents: data || [],
      total: count || 0,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
