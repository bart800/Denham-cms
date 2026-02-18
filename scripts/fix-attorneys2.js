const{Client}=require('pg');
const fvData=require('../data/filevine-full-data.json');
const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});

(async()=>{
  await c.connect();
  const {rows:team}=await c.query("SELECT id, name FROM team_members");
  
  // Build flexible lookup
  const lookup={};
  team.forEach(t=>{
    lookup[t.name.toLowerCase()]=t.id;
  });
  // Manual aliases
  lookup['joey tisone']=lookup['joey'];
  lookup['chad robinson']=lookup['chad'];
  
  console.log('Lookup keys:', Object.keys(lookup).filter(k=>lookup[k]));

  let updated=0, notFound=0, skipped=0;
  for(const p of fvData){
    const f=p.sections?.caseSummary?.fields||{};
    const attyName=f['Primary Attorney'];
    if(!attyName)continue;
    
    const attyId=lookup[attyName.toLowerCase()];
    if(!attyId){console.log('No match:', attyName); continue;}
    
    // Match case by project name
    const clientName=p.projectName.split(' v. ')[0].trim();
    const reversed=clientName.includes(',') ? clientName.split(', ').reverse().join(' ').trim() : clientName;
    
    const {rows:cases}=await c.query(
      "SELECT id, client_name, attorney_id FROM cases WHERE client_name ILIKE $1 OR client_name ILIKE $2 OR client_name ILIKE $3",
      ['%'+clientName+'%', '%'+reversed+'%', '%'+clientName.split(',')[0].trim()+'%']
    );
    
    if(cases.length===0){notFound++; continue;}
    
    for(const cs of cases){
      if(cs.attorney_id!==attyId){
        await c.query("UPDATE cases SET attorney_id=$1 WHERE id=$2",[attyId, cs.id]);
        updated++;
      } else { skipped++; }
    }
  }

  console.log('Updated:', updated, 'Not found:', notFound, 'Already correct:', skipped);
  
  const {rows:counts}=await c.query("SELECT t.name, count(cs.id) as cases FROM team_members t LEFT JOIN cases cs ON cs.attorney_id=t.id GROUP BY t.name ORDER BY cases DESC");
  console.log('\nFinal:');
  counts.forEach(r=>{if(parseInt(r.cases)>0)console.log(' ',r.name+':', r.cases)});
  
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
