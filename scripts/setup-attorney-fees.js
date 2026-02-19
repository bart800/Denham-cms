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

  // Add fee_percentage column (25-40%, set at intake)
  await c.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS fee_percentage NUMERIC DEFAULT 33.33');
  console.log('Added fee_percentage column (default 33.33%)');

  // Update the trigger to also calculate attorney_fees
  await c.query(`
    CREATE OR REPLACE FUNCTION calculate_total_recovery()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.total_recovery := COALESCE(NEW.settlement_amount, 0) + COALESCE(NEW.undisputed_amount, 0);
      NEW.attorney_fees := NEW.total_recovery * COALESCE(NEW.fee_percentage, 33.33) / 100;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('Updated trigger: attorney_fees = total_recovery * fee_percentage / 100');

  // Update trigger to also fire on fee_percentage changes
  await c.query('DROP TRIGGER IF EXISTS trg_calc_total_recovery ON cases');
  await c.query(`
    CREATE TRIGGER trg_calc_total_recovery
    BEFORE INSERT OR UPDATE OF settlement_amount, undisputed_amount, fee_percentage ON cases
    FOR EACH ROW EXECUTE FUNCTION calculate_total_recovery();
  `);
  console.log('Trigger now fires on settlement_amount, undisputed_amount, OR fee_percentage changes');

  // Recalculate existing cases that have recovery amounts
  const res = await c.query(`
    UPDATE cases 
    SET total_recovery = COALESCE(settlement_amount, 0) + COALESCE(undisputed_amount, 0),
        attorney_fees = (COALESCE(settlement_amount, 0) + COALESCE(undisputed_amount, 0)) * COALESCE(fee_percentage, 33.33) / 100
    WHERE COALESCE(settlement_amount, 0) + COALESCE(undisputed_amount, 0) > 0
    RETURNING ref, total_recovery, attorney_fees, fee_percentage
  `);
  console.log(`Recalculated ${res.rowCount} cases:`, res.rows);

  await c.end();
  console.log('Done!');
})();
