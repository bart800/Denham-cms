const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const { rows } = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='calendar_events' ORDER BY ordinal_position`);
  console.log('calendar_events:', rows.map(c => `${c.column_name}(${c.data_type})`).join(', '));
  
  // Add missing columns
  const cols = rows.map(c => c.column_name);
  const adds = [];
  if (!cols.includes('outlook_event_id')) adds.push("ALTER TABLE calendar_events ADD COLUMN outlook_event_id text UNIQUE");
  if (!cols.includes('team_member_id')) adds.push("ALTER TABLE calendar_events ADD COLUMN team_member_id uuid");
  if (!cols.includes('timezone')) adds.push("ALTER TABLE calendar_events ADD COLUMN timezone text");
  if (!cols.includes('body_preview')) adds.push("ALTER TABLE calendar_events ADD COLUMN body_preview text");
  if (!cols.includes('organizer_email')) adds.push("ALTER TABLE calendar_events ADD COLUMN organizer_email text");
  if (!cols.includes('attendees')) adds.push("ALTER TABLE calendar_events ADD COLUMN attendees jsonb");
  if (!cols.includes('synced_from')) adds.push("ALTER TABLE calendar_events ADD COLUMN synced_from text");
  
  for (const sql of adds) { console.log('Running:', sql); await client.query(sql); }
  console.log(adds.length ? `Added ${adds.length} columns` : 'All columns exist');
  
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
