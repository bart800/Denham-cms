const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect().then(async () => {
  // Check the 5 closed cases
  const closed = await c.query("SELECT id, client_name, status FROM cases WHERE status = 'Closed'");
  console.log('Currently Closed:', closed.rows);

  // Check what Filevine phases exist in our V2 scraper data
  const fs = require('fs');
  try {
    const fvData = JSON.parse(fs.readFileSync('data/filevine-full-data.json', 'utf8'));
    // Find these 5 cases in FV data
    const closedNames = closed.rows.map(r => r.client_name.toLowerCase());
    for (const proj of fvData) {
      const name = (proj.projectName || proj.name || '').toLowerCase();
      if (closedNames.some(cn => name.includes(cn.split(',')[0].toLowerCase().trim()))) {
        console.log('\nFV match:', proj.projectName || proj.name);
        console.log('  Phase:', proj.phase || proj.phaseName || 'unknown');
        if (proj.intake) console.log('  Intake phase:', proj.intake.phase || proj.intake.phaseName);
      }
    }
  } catch (e) {
    console.log('Could not read FV data:', e.message);
  }

  // Check the cases_status_check constraint to see valid values
  const constraint = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conname LIKE '%status%'
  `);
  console.log('\nStatus constraints:', constraint.rows);

  c.end();
});
