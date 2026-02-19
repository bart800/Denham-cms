const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'db.amyttoowrroajffqubpd.supabase.co',
    port: 5432, user: 'postgres',
    password: 'f5fIQC4B8KaqcDH4',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Add settlement_amount and undisputed_amount columns
  await c.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC DEFAULT 0');
  await c.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS undisputed_amount NUMERIC DEFAULT 0');
  console.log('Added settlement_amount + undisputed_amount columns');

  // Create function to auto-calculate total_recovery
  await c.query(`
    CREATE OR REPLACE FUNCTION calculate_total_recovery()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.total_recovery := COALESCE(NEW.settlement_amount, 0) + COALESCE(NEW.undisputed_amount, 0);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('Created calculate_total_recovery function');

  // Trigger: whenever settlement_amount or undisputed_amount changes, recalc total_recovery
  await c.query('DROP TRIGGER IF EXISTS trg_calc_total_recovery ON cases');
  await c.query(`
    CREATE TRIGGER trg_calc_total_recovery
    BEFORE INSERT OR UPDATE OF settlement_amount, undisputed_amount ON cases
    FOR EACH ROW EXECUTE FUNCTION calculate_total_recovery();
  `);
  console.log('Created trigger');

  // Also add settlement and undisputed_payment as valid negotiation types
  // (no enum constraint, just documenting)
  console.log('Valid negotiation types now include: presuit_demand, defendant_offer, bottom_line, settlement, undisputed_payment');

  await c.end();
  console.log('Done!');
})();
