const { Client } = require('pg');

async function run() {
  const client = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS kpi_targets (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      metric text NOT NULL,
      category text NOT NULL,
      weekly_target numeric NOT NULL DEFAULT 0,
      assigned_to uuid REFERENCES team_members(id),
      role text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `);
  console.log('Created kpi_targets');

  await client.query(`
    CREATE TABLE IF NOT EXISTS kpi_actuals (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      metric text NOT NULL,
      week_start date NOT NULL,
      actual_value numeric NOT NULL DEFAULT 0,
      member_id uuid REFERENCES team_members(id),
      notes text,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('Created kpi_actuals');

  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS kpi_actuals_unique ON kpi_actuals(metric, week_start, COALESCE(member_id, '00000000-0000-0000-0000-000000000000'));`);
  console.log('Created unique index');

  await client.query(`DROP TRIGGER IF EXISTS update_kpi_targets_updated_at ON kpi_targets;`);
  await client.query(`CREATE TRIGGER update_kpi_targets_updated_at BEFORE UPDATE ON kpi_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();`);
  console.log('Created trigger');

  await client.query(`DELETE FROM kpi_targets WHERE assigned_to IS NULL AND role IS NULL;`);
  const targets = [
    ['leads', 'Marketing/Intake', 13],
    ['cases_signed', 'Marketing/Intake', 6],
    ['new_referral_interactions', 'Marketing/Intake', 1],
    ['presuit_demands_sent', 'Demands', 7],
    ['settlement_offers', 'Demands', 7],
    ['complaints_filed', 'Complaints', 5],
    ['discovery_served', 'Discovery', 5],
    ['discovery_drafted', 'Drafting', 5],
    ['complaints_drafted', 'Drafting', 5],
    ['demands_drafted', 'Drafting', 7],
    ['client_updates', 'Updates', 10],
    ['referral_source_updates', 'Updates', 1],
    ['cases_settled', 'Settlements', 2.5],
    ['undisputed_payments', 'Settlements', 2.5],
  ];
  for (const [metric, category, target] of targets) {
    await client.query(`INSERT INTO kpi_targets (metric, category, weekly_target) VALUES ($1, $2, $3)`, [metric, category, target]);
  }
  console.log('Seeded', targets.length, 'KPI targets');

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'case_tasks_assigned_to_fkey') THEN
        ALTER TABLE case_tasks ADD CONSTRAINT case_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES team_members(id);
      END IF;
    END $$;
  `);
  console.log('FK constraint ensured');

  await client.end();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
