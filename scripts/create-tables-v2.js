const { Client } = require('pg');

const sql = `
-- Case summaries (AI-generated)
CREATE TABLE IF NOT EXISTS case_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  summary_data JSONB DEFAULT '{}'::jsonb,
  model TEXT DEFAULT 'gpt-4o-mini',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id)
);
CREATE INDEX IF NOT EXISTS idx_case_summaries_case_id ON case_summaries(case_id);
ALTER TABLE case_summaries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_case_summaries') THEN
    CREATE POLICY "allow_all_case_summaries" ON case_summaries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_notifications_case_id ON notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_notifications') THEN
    CREATE POLICY "allow_all_notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

async function run() {
  const client = new Client({
    host: 'db.amyttoowrroajffqubpd.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'f5fIQC4B8KaqcDH4',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected');
  await client.query(sql);
  console.log('Tables created');
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
