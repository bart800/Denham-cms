const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  // Find Andrew in team_members
  const t = await c.query("SELECT id, name, role FROM team_members WHERE name ILIKE '%andrew%'");
  console.log('Andrew team:', t.rows);
  
  // Find cases assigned to Andrew
  if (t.rows.length > 0) {
    const r = await c.query("SELECT id, client_name, status FROM cases WHERE attorney_id = $1", [t.rows[0].id]);
    console.log('Andrew cases:', r.rows);
  }

  // Count closed cases
  const closed = await c.query("SELECT id, client_name FROM cases WHERE status = 'Closed'");
  console.log('Closed cases:', closed.rows);
  
  c.end();
});
