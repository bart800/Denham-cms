const{Client}=require('pg');
const fvData=require('../data/filevine-full-data.json');

const c=new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,database:'postgres',user:'postgres',password:'f5fIQC4B8KaqcDH4',ssl:{rejectUnauthorized:false}});

(async()=>{
  await c.connect();

  // Get existing team members
  const {rows:team}=await c.query("SELECT id, name FROM team_members");
  const teamMap=Object.fromEntries(team.map(t=>[t.name.toLowerCase(),t.id]));
  console.log('Existing team:', team.map(t=>t.name));

  // Manual name mappings for existing team members with short names
  const nameAliases = {
    'joey tisone': 'joey',
    'chad robinson': 'chad',
  };

  // Find all attorneys in FV data
  const attorneys=new Set();
  fvData.forEach(p=>{
    const f=p.sections?.caseSummary?.fields||{};
    if(f['Primary Attorney'])attorneys.add(f['Primary Attorney']);
    if(f['Secondary Attorney'])attorneys.add(f['Secondary Attorney']);
  });
  console.log('FV attorneys:', [...attorneys]);

  // Add missing attorneys
  // Apply aliases
  Object.entries(nameAliases).forEach(([full,short])=>{
    if(teamMap[short]) teamMap[full]=teamMap[short];
  });

  const missing=[...attorneys].filter(a=>!teamMap[a.toLowerCase()]);
  console.log('Missing from team:', missing);

  for(const name of missing){
    const email=name.toLowerCase().replace(/[^a-z]/g,'').slice(0,20)+'@denham.law';
    const initials=name.split(' ').map(w=>w[0]).join('').toUpperCase();
    const legacyId=900+missing.indexOf(name);
    const {rows}=await c.query(
      "INSERT INTO team_members (name, email, role, initials, color, legacy_id, title) VALUES ($1,$2,'Attorney',$3,$4,$5,'Attorney') RETURNING id, name",
      [name, email, initials, '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'), legacyId]
    );
    teamMap[name.toLowerCase()]=rows[0].id;
    console.log('Added:', rows[0].name, rows[0].id);
  }

  // Refresh team map
  const {rows:allTeam}=await c.query("SELECT id, name FROM team_members");
  const fullMap={};
  allTeam.forEach(t=>{
    fullMap[t.name.toLowerCase()]=t.id;
    // Also map first name + last name variants
    const parts=t.name.split(' ');
    if(parts.length>=2) fullMap[(parts[0]+' '+parts[parts.length-1]).toLowerCase()]=t.id;
  });

  // Build FV project name → attorney mapping
  let updated=0, notFound=0;
  for(const p of fvData){
    const f=p.sections?.caseSummary?.fields||{};
    const attyName=f['Primary Attorney'];
    if(!attyName)continue;

    const attyId=fullMap[attyName.toLowerCase()];
    if(!attyId){console.log('No team member for:', attyName); continue;}

    // Extract client name from project name (before " v. ")
    const clientName=p.projectName.split(' v. ')[0].trim();
    // Try matching by client_name
    const {rows:cases}=await c.query(
      "SELECT id, client_name, attorney_id FROM cases WHERE client_name ILIKE $1 OR client_name ILIKE $2",
      ['%'+clientName+'%', '%'+clientName.split(', ').reverse().join(' ')+'%']
    );

    if(cases.length===0){notFound++; continue;}

    for(const cs of cases){
      if(cs.attorney_id!==attyId){
        await c.query("UPDATE cases SET attorney_id=$1 WHERE id=$2",[attyId, cs.id]);
        updated++;
        if(updated<=20)console.log('Reassigned:', cs.client_name, '→', attyName);
      }
    }
  }

  console.log('\nDone. Updated:', updated, 'Not found:', notFound);

  // Final count
  const {rows:counts}=await c.query("SELECT t.name, count(cs.id) as cases FROM team_members t LEFT JOIN cases cs ON cs.attorney_id=t.id GROUP BY t.name ORDER BY cases DESC");
  console.log('\nFinal case counts:');
  counts.forEach(r=>console.log(' ',r.name+':', r.cases));

  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
