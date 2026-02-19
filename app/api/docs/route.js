import { supabase } from "../../../lib/supabase";
import { supabaseAdmin } from "../../../lib/supabase";

const BUCKET = "documents";

// GET /api/docs - List documents, browse folders, or get download URLs
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("case_id");
  const category = searchParams.get("category");
  const path = searchParams.get("path"); // For browsing storage directly
  const fileId = searchParams.get("id"); // Get single doc + signed URL
  const search = searchParams.get("search");
  const client = supabaseAdmin || supabase;

  try {
    // Get signed download URL for a specific document
    if (fileId) {
      const { data: doc, error } = await client
        .from("documents")
        .select("*")
        .eq("id", fileId)
        .single();
      if (error) return Response.json({ error: error.message }, { status: 404 });

      const { data: urlData, error: urlError } = await client.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

      return Response.json({
        ...doc,
        download_url: urlError ? null : urlData.signedUrl,
      });
    }

    // List documents from the database
    let q = client.from("documents").select("*");

    if (caseId) q = q.eq("case_id", caseId);
    if (category) q = q.eq("category", category);
    if (search) q = q.or(`filename.ilike.%${search}%,original_path.ilike.%${search}%,ai_summary.ilike.%${search}%,ai_category.ilike.%${search}%,category.ilike.%${search}%`);

    q = q.order("category").order("filename");

    const { data, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Group by category
    const grouped = {};
    for (const doc of data || []) {
      const cat = doc.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(doc);
    }

    return Response.json({ documents: data, grouped, total: (data || []).length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/docs - Upload a document
export async function POST(request) {
  const client = supabaseAdmin || supabase;
  if (!client) return Response.json({ error: "No Supabase client" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const caseId = formData.get("case_id");
    const category = formData.get("category") || "Uncategorized";
    const originalPath = formData.get("original_path") || "";

    if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
    if (!caseId) return Response.json({ error: "case_id required" }, { status: 400 });

    const filename = file.name;
    const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
    const storagePath = `${caseId}/${category}/${filename}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

    // Insert metadata into documents table
    const { data: doc, error: dbError } = await client
      .from("documents")
      .upsert({
        case_id: caseId,
        storage_path: storagePath,
        original_path: originalPath,
        filename,
        extension: ext,
        category,
        size_bytes: buffer.length,
        mime_type: file.type || "application/octet-stream",
        uploaded_at: new Date().toISOString(),
      }, { onConflict: "storage_path" })
      .select()
      .single();

    if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

    return Response.json({ success: true, document: doc });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/docs - Delete a document
export async function DELETE(request) {
  const client = supabaseAdmin || supabase;
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");

  if (!fileId) return Response.json({ error: "id required" }, { status: 400 });

  try {
    // Get the storage path first
    const { data: doc, error: fetchErr } = await client
      .from("documents")
      .select("storage_path")
      .eq("id", fileId)
      .single();

    if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 404 });

    // Delete from storage
    await client.storage.from(BUCKET).remove([doc.storage_path]);

    // Delete from database
    const { error: delErr } = await client
      .from("documents")
      .delete()
      .eq("id", fileId);

    if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
