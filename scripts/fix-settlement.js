const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  // Update rows
  const upd = await c.query("UPDATE cases SET status = 'Settlement' WHERE status = 'Settled' RETURNING id, client_name");
  console.log('Updated to Settlement:', upd.rows.length, 'cases');

  // Add constraint with Settlement
  await c.query(`ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK (status = ANY(ARRAY[
    'Intake', 'Investigation', 'Presuit Demand', 'Presuit Negotiation',
    'Litigation - Filed', 'Litigation - Discovery', 'Litigation - Mediation', 'Litigation - Trial Prep',
    'Appraisal', 'Settlement', 'Closed', 'Referred'
  ]))`);
  console.log('Constraint updated');

  // Tennessee cases not assigned to Joey
  const tn = await c.query(`
    SELECT c.id, c.client_name, c.status, t.name as attorney
    FROM cases c
    LEFT JOIN team_members t ON c.attorney_id = t.id
    WHERE c.jurisdiction = 'TN'
    AND (t.name NOT ILIKE '%joey%' OR c.attorney_id IS NULL)
    ORDER BY c.client_name
  `);
  console.log('\nTennessee cases NOT assigned to Joey:');
  tn.rows.forEach(r => console.log(`  ${r.client_name} — ${r.attorney || 'unassigned'} (${r.status})`));
  console.log('Total:', tn.rows.length);

  c.end();
});
