import { supabaseAdmin, supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const { data: doc, error } = await db
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Generate signed download URL if storage_path exists
    let download_url = null;
    if (doc.storage_path) {
      const { data: signed, error: signErr } = await db.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 3600); // 1 hour
      if (!signErr && signed) {
        download_url = signed.signedUrl;
      }
    }

    return NextResponse.json({ ...doc, download_url });
  } catch (err) {
    console.error("Document fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch document", detail: err.message }, { status: 500 });
  }
}
