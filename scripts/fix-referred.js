const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  // 1. Add "Referred" to the status constraint
  await c.query("ALTER TABLE cases DROP CONSTRAINT cases_status_check");
  await c.query(`ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK (status = ANY(ARRAY[
    'Intake', 'Investigation', 'Presuit Demand', 'Presuit Negotiation',
    'Litigation - Filed', 'Litigation - Discovery', 'Litigation - Mediation', 'Litigation - Trial Prep',
    'Appraisal', 'Settled', 'Closed', 'Referred'
  ]))`);
  console.log('Added "Referred" to status constraint');

  // 2. Update the 5 cases from "Closed" to "Referred"
  const result = await c.query("UPDATE cases SET status = 'Referred' WHERE status = 'Closed' RETURNING id, client_name, status");
  console.log('Updated cases:', result.rows);

  c.end();
});
