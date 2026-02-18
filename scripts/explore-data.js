const { Client } = require('pg');
const c = new Client({
  host: 'db.amyttoowrroajffqubpd.supabase.co', port: 5432,
  database: 'postgres', user: 'postgres', password: 'f5fIQC4B8KaqcDH4',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await c.connect();
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cases' ORDER BY ordinal_position");
  console.log('CASES COLS:', cols.rows.map(r => r.column_name).join(', '));
  const cases = await c.query("SELECT id, ref, client_name FROM cases LIMIT 10");
  console.log('SAMPLE CASES:', JSON.stringify(cases.rows, null, 2));
  const dcols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='documents' ORDER BY ordinal_position");
  console.log('DOC COLS:', dcols.rows.map(r => r.column_name).join(', '));
  const docs = await c.query("SELECT * FROM documents WHERE case_id IS NULL LIMIT 5");
  console.log('SAMPLE UNLINKED DOCS:', JSON.stringify(docs.rows, null, 2));
  const total = await c.query("SELECT count(*) as total, count(case_id) as linked FROM documents");
  console.log('COUNTS:', total.rows[0]);
  // Get distinct top-level folder patterns from unlinked docs
  const folders = await c.query("SELECT DISTINCT split_part(storage_path, '/', 1) as folder FROM documents WHERE case_id IS NULL LIMIT 20");
  console.log('SAMPLE FOLDERS:', folders.rows.map(r => r.folder));
  await c.end();
})();
