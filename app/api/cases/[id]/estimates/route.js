import { supabaseAdmin, supabase } from "../../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  // Get estimate documents
  const { data: docs, error: docErr } = await db
    .from("documents")
    .select("*")
    .eq("case_id", id)
    .in("category", ["Estimates"])
    .order("modified_at", { ascending: false });

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  // Get manual estimate entries
  const { data: estimates, error: estErr } = await db
    .from("estimates")
    .select("*")
    .eq("case_id", id)
    .order("date", { ascending: false });

  if (estErr) return NextResponse.json({ error: estErr.message }, { status: 500 });

  // Signed URLs
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

  const totalAmount = (estimates || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return NextResponse.json({
    documents: docsWithUrls,
    estimates: estimates || [],
    totalAmount,
  });
}
