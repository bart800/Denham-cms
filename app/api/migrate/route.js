import { supabaseAdmin } from "../../../lib/supabase";

export async function POST() {
  if (!supabaseAdmin) return Response.json({ error: "No service role key" }, { status: 500 });
  const sql = `
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
    ALTER TABLE discovery_sets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE discovery_items ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_discovery_sets') THEN
        CREATE POLICY "allow_all_discovery_sets" ON discovery_sets FOR ALL USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_discovery_items') THEN
        CREATE POLICY "allow_all_discovery_items" ON discovery_items FOR ALL USING (true);
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_discovery_sets_case ON discovery_sets(case_id);
    CREATE INDEX IF NOT EXISTS idx_discovery_items_set ON discovery_items(set_id);
  `;
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
  if (error) {
    // Try via direct fetch to Supabase SQL endpoint
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ sql }),
    });
    if (!resp.ok) return Response.json({ error: "Migration failed: " + error.message + ". RPC not available - run SQL manually.", sql }, { status: 500 });
  }
  return Response.json({ success: true });
}
