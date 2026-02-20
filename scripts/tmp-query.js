const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const { rows } = await client.query('SELECT DISTINCT phase, case_type FROM workflow_templates ORDER BY case_type, phase');
  console.log('Phases in workflow_templates:');
  rows.forEach(r => console.log(`  ${r.case_type}: "${r.phase}"`));
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
