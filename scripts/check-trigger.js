const { Client } = require('pg');
async function run() {
  const c = new Client({
    host: 'db.amyttoowrroajffqubpd.supabase.co', port: 5432,
    database: 'postgres', user: 'postgres', password: 'f5fIQC4B8KaqcDH4',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  const r = await c.query("SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%update%' AND routine_schema='public'");
  console.log('Functions:', r.rows);
  
  // Check triggers on existing tables
  const t = await c.query("SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE trigger_schema='public' LIMIT 10");
  console.log('Triggers:', t.rows);
  await c.end();
}
run().catch(e => console.error(e.message));
