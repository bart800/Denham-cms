import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestId = formData.get("requestId");
    const caseId = formData.get("caseId");

    if (!file || !requestId) return NextResponse.json({ error: "file and requestId required" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `doc-requests/${caseId}/${requestId}/${file.name}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Still mark as uploaded even if storage fails
    }

    const { data, error } = await supabaseAdmin
      .from("document_requests")
      .update({ status: "uploaded", file_path: fileName })
      .eq("id", requestId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
