import { supabaseAdmin } from "../../../lib/supabase";

const MIGRATIONS = {
  discovery: `
    CREATE TABLE IF NOT EXISTS discovery_sets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('Interrogatories', 'RFP', 'RFA', 'Subpoena', 'Deposition')),
      direction TEXT NOT NULL CHECK (direction IN ('Sent', 'Received')),
      title TEXT NOT NULL,
      served_date DATE, due_date DATE, response_date DATE,
      status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue', 'Objected')),
      notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS discovery_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      set_id UUID NOT NULL REFERENCES discovery_sets(id) ON DELETE CASCADE,
      item_number INTEGER NOT NULL, request_text TEXT, response_text TEXT,
      status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Answered', 'Objected', 'Supplemented')),
      objection_text TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
    );
  `,
  documents: `
    CREATE TABLE IF NOT EXISTS public.documents (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
      storage_path text NOT NULL UNIQUE,
      original_path text,
      filename text NOT NULL,
      extension text,
      category text,
      size_bytes bigint,
      mime_type text,
      uploaded_at timestamptz DEFAULT now(),
      modified_at timestamptz,
      onedrive_item_id text,
      onedrive_modified_at timestamptz,
      ai_status text DEFAULT 'pending' CHECK (ai_status IN ('pending', 'processing', 'extracted', 'failed')),
      ai_extracted_text text,
      ai_summary text,
      ai_metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
    CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON public.documents(storage_path);
    CREATE INDEX IF NOT EXISTS idx_documents_ai_status ON public.documents(ai_status);
    CREATE INDEX IF NOT EXISTS idx_documents_filename ON public.documents(filename);
    ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_documents') THEN
        CREATE POLICY "allow_all_documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `,
};

export async function POST(request) {
  if (!supabaseAdmin) return Response.json({ error: "No service role key" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") || "all";

  const results = {};

  for (const [name, sql] of Object.entries(MIGRATIONS)) {
    if (target !== "all" && target !== name) continue;

    // Try exec_sql RPC first
    const { error } = await supabaseAdmin.rpc("exec_sql", { sql });
    if (error) {
      // exec_sql might not exist, try via fetch
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const resp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ sql }),
      });
      if (!resp.ok) {
        results[name] = { success: false, error: error.message, hint: "Run SQL manually in Supabase Dashboard" };
        continue;
      }
    }
    results[name] = { success: true };
  }

  return Response.json({ results });
}
