import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

const ALLOWED_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request) {
  try {
    if (!supabase) return Response.json({ error: "Server configuration error" }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get("file");
    const caseId = formData.get("caseId");
    const clientName = formData.get("clientName");

    if (!file || !caseId) {
      return Response.json({ error: "File and case ID are required" }, { status: 400 });
    }

    // Validate type
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return Response.json({ error: "File type not allowed. Please upload PDF, JPG, PNG, or DOCX files." }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "File is too large. Maximum size is 25MB." }, { status: 400 });
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${caseId}/client-uploads/${timestamp}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return Response.json({ error: "Failed to upload file. Please try again." }, { status: 500 });
    }

    // Add record to documents table
    const { error: dbError } = await supabase.from("documents").insert({
      case_id: caseId,
      storage_path: storagePath,
      original_path: `Client Upload/${file.name}`,
      filename: file.name,
      extension: ext,
      category: "Client Upload",
      size_bytes: file.size,
      mime_type: file.type,
      uploaded_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      // Clean up the uploaded file
      await supabase.storage.from("documents").remove([storagePath]);
      return Response.json({ error: "Failed to save document record." }, { status: 500 });
    }

    return Response.json({ success: true, filename: file.name });
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
