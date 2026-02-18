const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const c = new Client({
    host: 'db.amyttoowrroajffqubpd.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'f5fIQC4B8KaqcDH4',
    ssl: { rejectUnauthorized: false }
  });

  await c.connect();
  console.log('Connected!');

  const migrations = ['010_contacts.sql', '011_email_matched_by.sql'];

  for (const m of migrations) {
    const sql = fs.readFileSync(`supabase/migrations/${m}`, 'utf8');
    try {
      await c.query(sql);
      console.log(`✅ ${m}`);
    } catch (e) {
      console.error(`❌ ${m}:`, e.message);
    }
  }

  // Verify
  const r1 = await c.query("SELECT count(*)::int as n FROM contacts");
  console.log('contacts:', r1.rows[0].n, 'rows');
  const r2 = await c.query("SELECT count(*)::int as n FROM case_contacts");
  console.log('case_contacts:', r2.rows[0].n, 'rows');
  const r3 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='case_emails' AND column_name='matched_by'");
  console.log('case_emails.matched_by:', r3.rows.length > 0 ? 'exists' : 'MISSING');

  await c.end();
  console.log('Done!');
}

run().catch(e => { console.error(e.message); process.exit(1); });
