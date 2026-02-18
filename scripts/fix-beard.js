const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  const r = await c.query("SELECT id, client_name, status FROM cases WHERE client_name ILIKE '%beard%'");
  console.log('Beard cases:', r.rows);
  if (r.rows.length > 0) {
    const upd = await c.query("UPDATE cases SET status = 'Referred' WHERE client_name ILIKE '%beard%' RETURNING id, client_name, status");
    console.log('Updated:', upd.rows);
  }
  c.end();
});
