const{Client}=require('pg');
const XLSX=require('xlsx');

const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});

(async()=>{
  await c.connect();
  
  // Get team
  const {rows:team}=await c.query("SELECT id, name FROM team_members");
  const lookup={};
  team.forEach(t=>lookup[t.name.toLowerCase()]=t.id);
  // Aliases
  lookup['christopher']=lookup['christopher bailey'];
  lookup['joey tisone']=lookup['joey'];
  lookup['chad robinson']=lookup['chad'];
  
  console.log('Team lookup built');
  
  // Read BOTH xlsx files
  const files=['data/filevine-projects-full-2026-02-18.xlsx'];
  
  for(const file of files){
    const wb=XLSX.readFile(file);
    const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    console.log('\nProcessing:', file, '—', data.length, 'rows');
    
    let updated=0, matched=0, notFound=0;
    
    for(const row of data){
      const name=row.Name||'';
      const primaryAtty=(row['First Primary']||'').trim();
      if(!primaryAtty)continue;
      
      const attyId=lookup[primaryAtty.toLowerCase()];
      if(!attyId){console.log('No team match for attorney:', primaryAtty); continue;}
      
      // Match case by project name
      const clientName=name.split(' v. ').shift().replace(' v ',  ' v. ').trim();
      const reversed=clientName.includes(',') ? clientName.split(',').map(s=>s.trim()).reverse().join(' ') : clientName;
      const lastName=clientName.split(',')[0].split(' ').pop().trim();
      
      const {rows:cases}=await c.query(
        "SELECT id, client_name, attorney_id FROM cases WHERE LOWER(client_name) LIKE $1 OR LOWER(client_name) LIKE $2 OR LOWER(client_name) LIKE $3",
        ['%'+clientName.toLowerCase()+'%', '%'+reversed.toLowerCase()+'%', '%'+lastName.toLowerCase()+'%']
      );
      
      if(cases.length===0){
        notFound++;
        continue;
      }
      
      // Find best match (exact or closest)
      let best=cases[0];
      for(const cs of cases){
        if(cs.client_name.toLowerCase()===clientName.toLowerCase() || cs.client_name.toLowerCase()===reversed.toLowerCase()){
          best=cs; break;
        }
      }
      
      matched++;
      if(best.attorney_id!==attyId){
        await c.query("UPDATE cases SET attorney_id=$1 WHERE id=$2",[attyId, best.id]);
        updated++;
      }
    }
    
    console.log('Matched:', matched, 'Updated:', updated, 'Not found:', notFound);
  }
  
  // Final counts
  const {rows:counts}=await c.query(
    "SELECT t.name, count(cs.id) as cases FROM team_members t LEFT JOIN cases cs ON cs.attorney_id=t.id GROUP BY t.name ORDER BY cases DESC"
  );
  console.log('\nFinal case counts:');
  counts.filter(r=>parseInt(r.cases)>0).forEach(r=>console.log(' ',r.name+':',r.cases));
  
  const {rows:total}=await c.query("SELECT count(*) FROM cases");
  console.log('Total cases:', total[0].count);
  
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
