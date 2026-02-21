const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  await client.query("ALTER TABLE case_emails ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false");
  console.log('Added has_attachments column');
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
