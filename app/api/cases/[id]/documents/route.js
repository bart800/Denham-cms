import { supabaseAdmin, supabase } from "../../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  let query = db
    .from("documents")
    .select("*", { count: "exact" })
    .eq("case_id", id)
    .order("modified_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    const categories = category.split(",").map((c) => c.trim());
    query = query.in("category", categories);
  }

  const { data: docs, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate signed URLs
  const docsWithUrls = await Promise.all(
    (docs || []).map(async (doc) => {
      let signedUrl = null;
      if (doc.storage_path) {
        const { data } = await db.storage
          .from("documents")
          .createSignedUrl(doc.storage_path, 3600);
        signedUrl = data?.signedUrl || null;
      }
      return { ...doc, signedUrl };
    })
  );

  return NextResponse.json({
    documents: docsWithUrls,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
