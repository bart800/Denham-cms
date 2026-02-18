const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  // Add is_met column for deadline tracking
  await c.query("ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_met BOOLEAN DEFAULT false");
  await c.query("ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS met_at TIMESTAMPTZ");
  await c.query("ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS met_by UUID");
  console.log('Added is_met, met_at, met_by columns');
  c.end();
});
