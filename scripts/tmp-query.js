const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  .then(()=>c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cases' AND column_name LIKE '%settl%' OR (table_name='cases' AND column_name LIKE '%date%') ORDER BY column_name"))
  .then(r=>{console.log(r.rows.map(x=>x.column_name));c.end()})
