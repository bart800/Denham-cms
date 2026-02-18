const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  // Get Bart's team_member id
  const bart = await c.query("SELECT id FROM team_members WHERE name ILIKE '%bart%denham%'");
  console.log('Bart:', bart.rows[0]);

  // Reassign Colley to Bart
  const upd = await c.query("UPDATE cases SET attorney_id = $1 WHERE client_name = 'Colley, Carissa' RETURNING id, client_name", [bart.rows[0].id]);
  console.log('Reassigned:', upd.rows);

  // Remove Andrew from team_members
  const del = await c.query("DELETE FROM team_members WHERE name = 'Andrew Bailey' RETURNING id, name");
  console.log('Removed:', del.rows);

  c.end();
});
