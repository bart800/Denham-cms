const { Client } = require('pg');
const c = new Client({ host: 'db.amyttoowrroajffqubpd.supabase.co', port: 5432, user: 'postgres', password: 'f5fIQC4B8KaqcDH4', database: 'postgres', ssl: { rejectUnauthorized: false } });

async function run() {
  await c.connect();
  
  await c.query(`
    CREATE TABLE IF NOT EXISTS settlement_scenarios (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
      name text NOT NULL DEFAULT 'Scenario',
      property_damage numeric DEFAULT 0,
      depreciation numeric DEFAULT 0,
      deductible numeric DEFAULT 0,
      policy_limits numeric DEFAULT 0,
      additional_living_expenses numeric DEFAULT 0,
      code_upgrades numeric DEFAULT 0,
      insurer_offer numeric DEFAULT 0,
      our_demand numeric DEFAULT 0,
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `);
  console.log('settlement_scenarios created');

  await c.query(`
    CREATE TABLE IF NOT EXISTS case_reminders (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
      reminder_type text NOT NULL DEFAULT 'general',
      message text NOT NULL,
      due_date timestamptz NOT NULL,
      completed boolean DEFAULT false,
      completed_at timestamptz,
      created_by text,
      auto_generated boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('case_reminders created');

  await c.query(`
    CREATE TABLE IF NOT EXISTS court_deadlines (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
      deadline_type text NOT NULL,
      title text NOT NULL,
      description text,
      due_date timestamptz NOT NULL,
      jurisdiction text DEFAULT 'FL',
      auto_calculated boolean DEFAULT false,
      source_event text,
      source_date timestamptz,
      completed boolean DEFAULT false,
      completed_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('court_deadlines created');

  await c.query(`CREATE INDEX IF NOT EXISTS idx_settlement_scenarios_case ON settlement_scenarios(case_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_case_reminders_case ON case_reminders(case_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_case_reminders_due ON case_reminders(due_date) WHERE NOT completed`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_court_deadlines_case ON court_deadlines(case_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_court_deadlines_due ON court_deadlines(due_date) WHERE NOT completed`);
  console.log('indexes created');

  await c.end();
  console.log('DONE');
}

run().catch(e => { console.error(e); c.end(); process.exit(1); });
