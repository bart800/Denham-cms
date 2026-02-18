const{Client}=require('pg');
const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});
(async()=>{
  await c.connect();
  const r1=await c.query("SELECT id, name, email, role FROM team_members WHERE name ILIKE '%chris%' OR name ILIKE '%bailey%'");
  console.log('Team:', r1.rows);
  if(r1.rows[0]){
    const r2=await c.query('SELECT count(*) FROM cases WHERE attorney_id=$1',[r1.rows[0].id]);
    console.log('Cases assigned:', r2.rows[0].count);
  }
  const r3=await c.query("SELECT t.name, count(cs.id) as cases FROM team_members t LEFT JOIN cases cs ON cs.attorney_id=t.id WHERE t.role='Attorney' OR t.title ILIKE '%attorney%' GROUP BY t.name ORDER BY cases DESC");
  console.log('Cases by attorney:', r3.rows);
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
