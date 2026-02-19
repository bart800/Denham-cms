import { supabaseAdmin, supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;
const ANALYZE_URL_BASE = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function POST(request) {
  try {
    const { case_id, document_ids, force } = await request.json();

    if (!db) return NextResponse.json({ error: "No database client" }, { status: 500 });
    if (!case_id && !document_ids?.length) {
      return NextResponse.json({ error: "Provide case_id or document_ids" }, { status: 400 });
    }

    // Get documents to analyze
    let query = db.from("documents").select("id, filename, extension, ai_status, storage_path");

    if (case_id) {
      query = query.eq("case_id", case_id);
    } else {
      query = query.in("id", document_ids);
    }

    // Skip already-completed unless force=true
    if (!force) {
      query = query.neq("ai_status", "completed");
    }

    // Only analyze supported file types
    const { data: docs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const supportedExts = ["pdf", "txt", "csv", "html", "htm", "xml", "json", "md"];
    const analyzable = docs.filter(d => {
      const ext = (d.extension || "").toLowerCase().replace(/^\./, "");
      return supportedExts.includes(ext) && d.storage_path;
    });

    const skipped = docs.length - analyzable.length;

    // Analyze each document sequentially to avoid overwhelming the server
    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (const doc of analyzable) {
      try {
        // Call the analyze endpoint internally by importing the logic
        // Instead of HTTP calls, we directly call the analyze API
        const analyzeUrl = `${ANALYZE_URL_BASE}/api/docs/analyze`;
        const res = await fetch(analyzeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: doc.id }),
        });

        const result = await res.json();

        if (res.ok) {
          succeeded++;
          results.push({
            id: doc.id,
            filename: doc.filename,
            status: "completed",
            doc_type: result.doc_type,
            summary: result.summary?.slice(0, 100),
          });
        } else {
          failed++;
          results.push({
            id: doc.id,
            filename: doc.filename,
            status: "failed",
            error: result.error || result.detail,
          });
        }
      } catch (err) {
        failed++;
        results.push({
          id: doc.id,
          filename: doc.filename,
          status: "failed",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: docs.length,
      analyzed: succeeded,
      failed,
      skipped,
      results,
    });
  } catch (err) {
    console.error("Batch analysis error:", err);
    return NextResponse.json({ error: "Batch analysis failed", detail: err.message }, { status: 500 });
  }
}
