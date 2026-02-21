const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');

async function run() {
  await c.connect();
  await c.query("ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS depends_on_tasks text[] DEFAULT '{}'");
  console.log('Column added successfully');
  
  // Verify
  const res = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'case_tasks' AND column_name = 'depends_on_tasks'");
  console.log('Verification:', res.rows);
  
  await c.end();
}
run().catch(e => { console.error(e); c.end(); });
