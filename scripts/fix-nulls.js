const{Client}=require('pg');
const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});
(async()=>{
  await c.connect();
  const{rows}=await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cases' AND is_nullable='NO' AND column_name NOT IN ('id','ref','client_name')");
  console.log('NOT NULL cols:', rows.map(r=>r.column_name));
  for(const r of rows){
    await c.query('ALTER TABLE cases ALTER COLUMN "'+r.column_name+'" DROP NOT NULL');
    console.log('Fixed:', r.column_name);
  }
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
