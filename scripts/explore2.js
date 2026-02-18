const { Client } = require('pg');
const c = new Client({
  host: 'db.amyttoowrroajffqubpd.supabase.co', port: 5432,
  database: 'postgres', user: 'postgres', password: 'f5fIQC4B8KaqcDH4',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await c.connect();
  // Get distinct folder names from unlinked docs
  const folders = await c.query(`
    SELECT DISTINCT split_part(storage_path, '/', 2) as folder, count(*) as cnt
    FROM documents WHERE case_id IS NULL AND storage_path LIKE 'unmatched/%'
    GROUP BY folder ORDER BY cnt DESC LIMIT 40
  `);
  console.log('TOP FOLDERS:');
  folders.rows.forEach(r => console.log(`  ${r.cnt}\t${r.folder}`));
  
  const caseCount = await c.query("SELECT count(*) FROM cases");
  console.log('Total cases:', caseCount.rows[0].count);
  
  // Are there unlinked docs NOT under unmatched/?
  const other = await c.query("SELECT count(*) FROM documents WHERE case_id IS NULL AND storage_path NOT LIKE 'unmatched/%'");
  console.log('Unlinked not under unmatched/:', other.rows[0].count);
  
  await c.end();
})();
