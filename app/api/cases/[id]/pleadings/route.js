import { supabaseAdmin, supabase } from "../../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  // Get pleading documents
  const { data: docs, error: docErr } = await db
    .from("documents")
    .select("*")
    .eq("case_id", id)
    .in("category", ["Pleadings", "E-Pleadings"])
    .order("modified_at", { ascending: false });

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  // Get manual pleading entries
  const { data: pleadings, error: plErr } = await db
    .from("pleadings")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  if (plErr) return NextResponse.json({ error: plErr.message }, { status: 500 });

  const docsWithUrls = await Promise.all(
    (docs || []).map(async (doc) => {
      let signedUrl = null;
      if (doc.storage_path) {
        const { data } = await db.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
        signedUrl = data?.signedUrl || null;
      }
      return { ...doc, signedUrl };
    })
  );

  return NextResponse.json({
    documents: docsWithUrls,
    pleadings: pleadings || [],
  });
}
