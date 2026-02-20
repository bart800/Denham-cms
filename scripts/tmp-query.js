const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  .then(()=>c.query("ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check"))
  .then(()=>c.query("UPDATE cases SET status='Presuit' WHERE status IN ('Intake','Investigation')"))
  .then(r=>{console.log(`Updated ${r.rowCount} cases to Presuit`);
    return c.query("ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK (status IN ('Presuit','Presuit Demand','Litigation - Filed','Litigation - Discovery','Litigation - Mediation','Litigation - Trial Prep','Appraisal','Settled','Closed','Referred'))")})
  .then(()=>{console.log('Constraint updated');
    return c.query("SELECT status, COUNT(*) as cnt FROM cases GROUP BY status ORDER BY cnt DESC")})
  .then(r=>{console.log('Final:', JSON.stringify(r.rows));c.end()})
  .catch(e=>{console.error(e.message);c.end()})
