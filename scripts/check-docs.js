const{Client}=require('pg');
const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});
(async()=>{
  await c.connect();
  const r1=await c.query('SELECT count(*) as total, count(case_id) as linked FROM documents');
  console.log('Docs:', r1.rows[0]);
  const r2=await c.query('SELECT category, count(*) FROM documents WHERE case_id IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 20');
  console.log('Categories:', r2.rows);
  const r3=await c.query("SELECT storage_path FROM documents WHERE case_id IS NOT NULL ORDER BY random() LIMIT 10");
  console.log('Sample paths:', r3.rows.map(r=>r.storage_path));
  const r4=await c.query("SELECT storage_path FROM documents WHERE case_id IS NOT NULL AND storage_path ILIKE '%estimat%' LIMIT 5");
  console.log('Estimate docs:', r4.rows.map(r=>r.storage_path));
  const r5=await c.query("SELECT storage_path FROM documents WHERE case_id IS NOT NULL AND storage_path ILIKE '%plead%' LIMIT 5");
  console.log('Pleading docs:', r5.rows.map(r=>r.storage_path));
  // Check what the estimates and pleadings tables look like
  const r6=await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='estimates' ORDER BY ordinal_position");
  console.log('Estimates columns:', r6.rows.map(r=>r.column_name));
  const r7=await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='pleadings' ORDER BY ordinal_position");
  console.log('Pleadings columns:', r7.rows.map(r=>r.column_name));
  const r8=await c.query("SELECT count(*) FROM estimates");
  console.log('Estimates rows:', r8.rows[0].count);
  const r9=await c.query("SELECT count(*) FROM pleadings");
  console.log('Pleadings rows:', r9.rows[0].count);
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
