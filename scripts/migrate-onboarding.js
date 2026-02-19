const { Client } = require('pg');

async function migrate() {
  const c = new Client({ 
    connectionString: 'postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  await c.connect();
  console.log('Connected to database');

  const sqls = [
    'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS profile_picture_url text',
    'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS microsoft_connected boolean DEFAULT false',
    'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS onboarded_at timestamptz',
    'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS phone text',
    'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS bar_number text',
    'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS auth_user_id uuid',
    `CREATE TABLE IF NOT EXISTS team_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      role text NOT NULL,
      invited_by uuid REFERENCES team_members(id),
      token text UNIQUE NOT NULL,
      expires_at timestamptz NOT NULL,
      status text DEFAULT 'pending',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    'ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY',
    'DROP POLICY IF EXISTS allow_all_service ON team_invites',
    'CREATE POLICY allow_all_service ON team_invites FOR ALL USING (true)',
  ];

  for (const sql of sqls) {
    try {
      await c.query(sql);
      console.log('OK:', sql.substring(0, 60));
    } catch(e) {
      console.log('ERR:', e.message.substring(0, 100));
    }
  }

  // Create storage bucket via API
  const fetch = globalThis.fetch;
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA';
  
  try {
    const res = await fetch('https://amyttoowrroajffqubpd.supabase.co/storage/v1/bucket', {
      method: 'POST',
      headers: { 
        'apikey': serviceKey, 
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'team-avatars', name: 'team-avatars', public: true })
    });
    const data = await res.json();
    console.log('Storage bucket:', JSON.stringify(data));
  } catch(e) {
    console.log('Storage error:', e.message);
  }

  // Add public access policy for storage
  try {
    await c.query(`
      INSERT INTO storage.policies (name, bucket_id, definition, operation)
      VALUES ('Public read', 'team-avatars', '(true)', 'SELECT')
      ON CONFLICT DO NOTHING
    `);
  } catch(e) {
    // Try RLS policy approach
    try {
      await c.query("CREATE POLICY IF NOT EXISTS public_read ON storage.objects FOR SELECT USING (bucket_id = 'team-avatars')");
    } catch(e2) {
      console.log('Storage policy note:', e2.message.substring(0, 100));
    }
  }

  await c.end();
  console.log('Migration complete!');
}

migrate().catch(e => { console.error(e); process.exit(1); });
