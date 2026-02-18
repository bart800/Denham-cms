const{Client}=require('pg');
const XLSX=require('xlsx');

const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});

function excelDate(serial){
  if(!serial||typeof serial!=='number')return null;
  const d=new Date((serial-25569)*86400000);
  return d.toISOString().split('T')[0];
}

(async()=>{
  await c.connect();
  
  const wb=XLSX.readFile('data/filevine-projects-full-2026-02-18.xlsx');
  const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log('XLSX rows:', data.length);
  
  // Get existing cases
  const {rows:existing}=await c.query("SELECT id, client_name, ref FROM cases");
  const existingNames=new Set(existing.map(e=>e.client_name.toLowerCase().trim()));
  console.log('Existing cases:', existing.length);
  
  // Get team members for attorney assignment
  const {rows:team}=await c.query("SELECT id, name FROM team_members");
  const teamLookup={};
  team.forEach(t=>{ teamLookup[t.name.toLowerCase()]=t.id; });
  teamLookup['christopher']=teamLookup['christopher bailey'];
  
  // Find next ref number
  const {rows:maxRef}=await c.query("SELECT ref FROM cases ORDER BY ref DESC LIMIT 1");
  let nextNum=parseInt(maxRef[0]?.ref?.split('-')[1]||'0')+1;
  
  // Phase → Status mapping
  const phaseMap={
    'Case Intake and Investigation':'Intake',
    'Pre-Suit':'Presuit Demand',
    'Demand and Negotiation':'Presuit Demand',
    'Litigation':'Litigation - Filed',
    'Settlement Decision':'Settled',
    'Case Monitoring':'Investigation',
    'Appraisal':'Appraisal',
    'Referred':'Closed',
  };
  
  let added=0, skipped=0, updated=0;
  
  for(const row of data){
    const name=row.Name;
    if(!name)continue;
    
    // Extract client name (before " v. ")
    const clientName=name.split(' v. ')[0].trim();
    const clientLower=clientName.toLowerCase();
    // Also try reversed for "Last, First" format
    const reversed=clientName.includes(',') ? clientName.split(',').map(s=>s.trim()).reverse().join(' ').toLowerCase() : clientLower;
    
    const projectType=row['Project Type']||'Property Casualty';
    const type=projectType==='Personal Injury'?'Personal Injury':'Property Casualty';
    const phase=row.Phase||'';
    const status=phaseMap[phase]||'Intake';
    const attorney=row['First Primary']||'';
    const attyId=teamLookup[attorney.toLowerCase()]||null;
    const dateOpened=excelDate(row['Create Date']);
    const email=row['Email Address']||null;
    const fvUrl=row['Filevine URL']||null;
    const fvId=row['Project ID']||null;
    
    // Check if already exists
    const isExisting=existingNames.has(clientLower)||existingNames.has(reversed);
    
    if(isExisting){
      // Update attorney assignment if different
      if(attyId){
        const {rows:match}=await c.query(
          "SELECT id, attorney_id FROM cases WHERE LOWER(client_name)=$1 OR LOWER(client_name)=$2",
          [clientLower, reversed]
        );
        for(const m of match){
          if(m.attorney_id!==attyId){
            await c.query("UPDATE cases SET attorney_id=$1 WHERE id=$2",[attyId,m.id]);
            updated++;
          }
        }
      }
      skipped++;
      continue;
    }
    
    // New case — insert
    const ref=`DC-${String(nextNum++).padStart(4,'0')}`;
    try{
      await c.query(
        `INSERT INTO cases (ref, client_name, type, status, attorney_id, date_opened, client_email, jurisdiction)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ref, clientName, type, status, attyId, dateOpened, email, 'KY']
      );
      added++;
      console.log('Added:', ref, clientName, '('+type+')', '→', attorney);
    }catch(err){
      console.error('Error inserting', clientName, err.message);
    }
  }
  
  console.log('\nDone. Added:', added, 'Skipped (existing):', skipped, 'Attorney updated:', updated);
  
  // Final counts
  const {rows:counts}=await c.query(
    "SELECT t.name, count(cs.id) as cases FROM team_members t LEFT JOIN cases cs ON cs.attorney_id=t.id GROUP BY t.name ORDER BY cases DESC"
  );
  console.log('\nFinal case counts by attorney:');
  counts.filter(r=>parseInt(r.cases)>0).forEach(r=>console.log(' ',r.name+':',r.cases));
  
  const {rows:typeCounts}=await c.query("SELECT type, count(*) FROM cases GROUP BY type");
  console.log('\nBy type:', typeCounts);
  
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
