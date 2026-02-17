const { Client } = require('pg');

// Supabase direct connection (transaction mode)
const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL || `postgresql://postgres.amyttoowrroajffqubpd:${process.env.SUPABASE_DB_PASSWORD || 'YOUR_DB_PASSWORD'}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

const SQL = `
-- Documents table for file storage metadata
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON public.documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_documents_ai_status ON public.documents(ai_status);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON public.documents(filename);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow all access (service role bypasses RLS anyway, this is for anon/authenticated)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_documents') THEN
    CREATE POLICY "allow_all_documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Also create exec_sql function for future migrations
CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
BEGIN EXECUTE sql; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres');
    
    await client.query(SQL);
    console.log('✅ documents table created successfully');
    console.log('✅ exec_sql function created');
    
    // Verify
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents' ORDER BY ordinal_position");
    console.log('\nTable columns:');
    res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
  } catch (err) {
    console.error('Error:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.log('\nYou need to set SUPABASE_DB_PASSWORD environment variable.');
      console.log('Find it at: https://supabase.com/dashboard/project/amyttoowrroajffqubpd/settings/database');
    }
  } finally {
    await client.end();
  }
}

main();
