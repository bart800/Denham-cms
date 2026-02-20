const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  // Check what "Other" and "Property Casualty" cases look like
  .then(()=>c.query("SELECT ref, client_name, type, insurer FROM cases WHERE type IN ('Other','Property Casualty','Property') ORDER BY type, ref LIMIT 30"))
  .then(r=>{console.log(JSON.stringify(r.rows,null,2));c.end()})
