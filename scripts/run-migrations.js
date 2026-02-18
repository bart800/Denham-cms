const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const c = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.amyttoowrroajffqubpd',
    password: 'f5fIQC4B8KaqcDH4',
    ssl: { rejectUnauthorized: false }
  });

  await c.connect();
  console.log('Connected to Supabase!');

  const migrations = ['010_contacts.sql', '011_email_matched_by.sql'];

  for (const m of migrations) {
    const sql = fs.readFileSync(`supabase/migrations/${m}`, 'utf8');
    try {
      await c.query(sql);
      console.log(`✅ ${m} OK`);
    } catch (e) {
      console.error(`❌ ${m} FAILED:`, e.message);
    }
  }

  // Verify
  const r1 = await c.query("SELECT count(*)::int as n FROM contacts");
  console.log('contacts:', r1.rows[0].n, 'rows');
  const r2 = await c.query("SELECT count(*)::int as n FROM case_contacts");
  console.log('case_contacts:', r2.rows[0].n, 'rows');

  await c.end();
  console.log('Done!');
}

run().catch(e => { console.error(e.message); process.exit(1); });
