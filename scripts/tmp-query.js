const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  .then(()=>c.query("SELECT * FROM team_members WHERE email='kami@denham.law'"))
  .then(r=>{console.log('Member:',JSON.stringify(r.rows,null,2));return c.query("SELECT * FROM team_invites WHERE email='kami@denham.law' ORDER BY created_at DESC LIMIT 1")})
  .then(r=>{console.log('Invite:',JSON.stringify(r.rows,null,2));c.end()})
