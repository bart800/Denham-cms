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
  const wb=XLSX.readFile('data/filevine-projects-2026-02-18-v2.xlsx');
  const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log('XLSX rows:', data.length);

  let updated=0, notFound=0;
  for(const row of data){
    const name=row.Name||'';
    const clientName=name.split(' v. ')[0].replace(' v ', ' v. ').trim();
    const clientFull=row['Client Full Name']||clientName;
    
    // Try matching
    const {rows:cases}=await c.query(
      "SELECT id, client_name FROM cases WHERE LOWER(client_name) LIKE $1 OR LOWER(client_name) LIKE $2 OR LOWER(client_name) LIKE $3",
      ['%'+clientName.toLowerCase()+'%', '%'+clientFull.toLowerCase()+'%',
       '%'+(clientName.includes(',')?clientName.split(',').map(s=>s.trim()).reverse().join(' ').toLowerCase():clientName.toLowerCase())+'%']
    );
    
    if(cases.length===0){
      console.log('NOT FOUND:', clientName);
      notFound++;
      continue;
    }
    
    for(const cs of cases){
      const updates=[];
      const vals=[];
      let idx=1;
      
      // Client email
      if(row['Client Emails']){
        updates.push('client_email=$'+idx); vals.push(row['Client Emails'].split(',')[0].trim()); idx++;
      }
      // Client phone
      if(row['Client Phones']){
        const phone=String(row['Client Phones']).split(',')[0].trim();
        updates.push('client_phone=$'+idx); vals.push(phone); idx++;
      }
      // Date of loss / incident date
      if(row['Incident Date']){
        const dol=excelDate(row['Incident Date']);
        if(dol){ updates.push('date_of_loss=$'+idx); vals.push(dol); idx++; }
      }
      // Property address from client address
      if(row['Client Address 1']){
        updates.push('property_address=$'+idx); vals.push(row['Client Address 1']); idx++;
      }
      // Cause of loss from incident description
      if(row['Incident Description']){
        updates.push('cause_of_loss=$'+idx); vals.push(row['Incident Description'].substring(0,500)); idx++;
      }
      
      if(updates.length>0){
        vals.push(cs.id);
        await c.query('UPDATE cases SET '+updates.join(',')+' WHERE id=$'+idx, vals);
        updated++;
        console.log('Updated:', cs.client_name, '—', updates.length, 'fields');
      }
    }
  }
  
  console.log('\nDone. Updated:', updated, 'Not found:', notFound);
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
