const { Client } = require('pg');

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

  const sql = `
CREATE TABLE IF NOT EXISTS case_demands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  title text,
  content text,
  html_content text,
  demand_amount numeric,
  status text DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  holder_type text DEFAULT 'other',
  amount numeric DEFAULT 0,
  negotiated_amount numeric,
  status text DEFAULT 'pending',
  contact_info text,
  payoff_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text DEFAULT 'other',
  date_incurred date,
  paid_by text DEFAULT 'firm',
  receipt_path text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  requested_by text,
  description text NOT NULL,
  status text DEFAULT 'pending',
  file_path text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  client_id uuid,
  datetime timestamptz NOT NULL,
  duration_min int DEFAULT 30,
  type text DEFAULT 'consultation',
  status text DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  changes jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_demands_case ON case_demands(case_id);
CREATE INDEX IF NOT EXISTS idx_liens_case ON liens(case_id);
CREATE INDEX IF NOT EXISTS idx_case_expenses_case ON case_expenses(case_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_case ON document_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_case ON appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);

-- RLS policies
ALTER TABLE case_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE liens ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='case_demands' AND policyname='Allow all for service role') THEN CREATE POLICY "Allow all for service role" ON case_demands FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='liens' AND policyname='Allow all for service role') THEN CREATE POLICY "Allow all for service role" ON liens FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='case_expenses' AND policyname='Allow all for service role') THEN CREATE POLICY "Allow all for service role" ON case_expenses FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_requests' AND policyname='Allow all for service role') THEN CREATE POLICY "Allow all for service role" ON document_requests FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='Allow all for service role') THEN CREATE POLICY "Allow all for service role" ON appointments FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_trail' AND policyname='Allow all for service role') THEN CREATE POLICY "Allow all for service role" ON audit_trail FOR ALL USING (true); END IF;
END $$;
`;

  await client.query(sql);
  console.log('All tables created successfully ✓');
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
