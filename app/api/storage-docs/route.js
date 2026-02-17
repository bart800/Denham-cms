import { supabaseAdmin, supabase } from "../../../lib/supabase";

const BUCKET = "documents";

// GET /api/storage-docs - Query documents table + signed URLs
export async function GET(request) {
  const client = supabaseAdmin || supabase;
  if (!client) return Response.json({ error: "No Supabase client" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("case_id");
  const search = searchParams.get("search");
  const fileId = searchParams.get("id");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = (page - 1) * limit;

  try {
    // Single document with signed download URL
    if (fileId) {
      const { data: doc, error } = await client
        .from("documents")
        .select("*")
        .eq("id", fileId)
        .single();
      if (error) return Response.json({ error: "Document not found" }, { status: 404 });

      const { data: urlData } = await client.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 3600);

      return Response.json({
        document: { ...doc, download_url: urlData?.signedUrl || null },
      });
    }

    // Build query
    let q = client.from("documents").select("*", { count: "exact" });

    if (caseId) q = q.eq("case_id", caseId);
    if (category) q = q.eq("category", category);
    if (search) q = q.or(`filename.ilike.%${search}%,original_path.ilike.%${search}%`);

    q = q.order("category").order("filename").range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Group by category
    const grouped = {};
    for (const doc of data || []) {
      const cat = doc.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(doc);
    }

    return Response.json({
      documents: data || [],
      grouped,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/storage-docs - Batch signed URLs
export async function POST(request) {
  const client = supabaseAdmin || supabase;
  if (!client) return Response.json({ error: "No Supabase client" }, { status: 500 });

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0)
      return Response.json({ error: "ids array required" }, { status: 400 });

    const { data: docs, error } = await client
      .from("documents")
      .select("id, storage_path, filename")
      .in("id", ids.slice(0, 50));

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const urls = {};
    for (const doc of docs || []) {
      const { data: urlData } = await client.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 3600);
      urls[doc.id] = urlData?.signedUrl || null;
    }

    return Response.json({ urls });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
