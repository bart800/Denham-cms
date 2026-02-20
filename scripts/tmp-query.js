const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  .then(()=>c.query("UPDATE cases SET type='Other' WHERE type IN ('Property Casualty','Property') RETURNING ref, client_name"))
  .then(r=>{console.log(`Merged ${r.rowCount} cases:`, r.rows.map(x=>`${x.ref} ${x.client_name}`));
    return c.query("SELECT type, COUNT(*) as cnt FROM cases GROUP BY type ORDER BY cnt DESC")})
  .then(r=>{console.log('\nFinal:', JSON.stringify(r.rows));c.end()})
