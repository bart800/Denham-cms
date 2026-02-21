const { Client } = require('pg');
const c = new Client({ host: 'db.amyttoowrroajffqubpd.supabase.co', port: 5432, user: 'postgres', password: 'f5fIQC4B8KaqcDH4', database: 'postgres', ssl: { rejectUnauthorized: false } });

async function run() {
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS backup_verification (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      verified_at timestamptz DEFAULT now(),
      table_counts jsonb,
      status text DEFAULT 'ok',
      notes text
    )
  `);
  console.log('backup_verification created');

  await c.query(`
    CREATE TABLE IF NOT EXISTS referral_sources (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      category text,
      contact_info text,
      notes text,
      cases_count int DEFAULT 0,
      total_recovery numeric DEFAULT 0,
      created_at timestamptz DEFAULT now()
    )
  `);
  console.log('referral_sources created');

  // Add referral columns to cases
  await c.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS referral_source text`);
  await c.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS referral_source_detail text`);
  console.log('referral columns added to cases');

  await c.end();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
