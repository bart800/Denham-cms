import { supabaseAdmin, supabase as supabaseAnon } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabaseAnon;

// GET: Check batch status for a case
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("case_id");
  if (!caseId) return NextResponse.json({ error: "case_id required" }, { status: 400 });

  const { data: docs, error } = await db
    .from("documents")
    .select("id, filename, ai_status, ai_summary")
    .eq("case_id", caseId)
    .in("ai_status", ["pending", "processing", "extracted", "failed"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = docs?.length || 0;
  const analyzed = docs?.filter(d => d.ai_status === "extracted").length || 0;
  const failed = docs?.filter(d => d.ai_status === "failed").length || 0;
  const pending = docs?.filter(d => d.ai_status === "pending").length || 0;
  const processing = docs?.filter(d => d.ai_status === "processing").length || 0;

  return NextResponse.json({ total, analyzed, failed, pending, processing, docs });
}

// POST: Kick off batch analysis for a case
export async function POST(request) {
  try {
    const { case_id, limit: maxDocs } = await request.json();
    if (!case_id) return NextResponse.json({ error: "case_id required" }, { status: 400 });

    // Get unanalyzed documents
    const { data: docs, error } = await db
      .from("documents")
      .select("id, filename, storage_path, extension, ai_status")
      .eq("case_id", case_id)
      .in("ai_status", ["pending", "failed"])
      .limit(maxDocs || 50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!docs?.length) return NextResponse.json({ message: "No documents to analyze", processed: 0 });

    // Process each document by calling the existing analyze endpoint
    const results = [];
    for (const doc of docs) {
      try {
        // Mark as processing
        await db.from("documents").update({ ai_status: "processing" }).eq("id", doc.id);

        // Call the existing analyze endpoint
        const baseUrl = request.headers.get("x-forwarded-proto") 
          ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
          : `http://${request.headers.get("host") || "localhost:3000"}`;
        
        const res = await fetch(`${baseUrl}/api/docs/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: doc.id, storage_path: doc.storage_path }),
        });

        const data = await res.json();
        results.push({ id: doc.id, filename: doc.filename, success: res.ok, analysis: data.analysis?.doc_type });
      } catch (err) {
        await db.from("documents").update({ ai_status: "failed" }).eq("id", doc.id);
        results.push({ id: doc.id, filename: doc.filename, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    return NextResponse.json({ processed: results.length, succeeded, failed: results.length - succeeded, results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
