const sql = `
CREATE TABLE IF NOT EXISTS portal_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id),
  client_name text NOT NULL,
  code text,
  code_expires_at timestamptz,
  token text UNIQUE,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) NOT NULL,
  sender_type text CHECK (sender_type IN ('client', 'firm')) NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_messages_case ON portal_messages(case_id, created_at);
`;

const resp = await fetch('https://amyttoowrroajffqubpd.supabase.co/rest/v1/rpc/exec_sql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA',
  },
  body: JSON.stringify({ query: sql }),
});
console.log(resp.status, await resp.text());

// If RPC doesn't exist, use psql-like approach via pg
if (resp.status !== 200) {
  console.log('RPC not available. Trying via pg...');
  const pg = await import('pg').catch(() => null);
  if (pg) {
    const client = new pg.default.Client({
      host: 'db.amyttoowrroajffqubpd.supabase.co',
      port: 5432,
      user: 'postgres',
      password: 'f5fIQC4B8KaqcDH4',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(sql);
    console.log('Tables created via pg');
    await client.end();
  } else {
    console.log('Install pg: npm i pg');
  }
}
