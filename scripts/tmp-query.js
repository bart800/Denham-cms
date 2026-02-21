const { Client } = require('pg');
const client = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');

async function run() {
  await client.connect();

  // Add trigger_event to workflow_templates
  await client.query(`ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS trigger_event text`);
  console.log('Added trigger_event to workflow_templates');

  // Map workflow templates to trigger events
  const mappings = [
    { pattern: '%LOR sent to BI%', event: 'lor_sent' },
    { pattern: '%LOR sent to client%', event: 'lor_sent' },
    { pattern: '%Demand served%', event: 'demand_served' },
    { pattern: '%ATR%sent%', event: 'atr_sent' },
    { pattern: '%Complaint filed%', event: 'complaint_filed' },
    { pattern: '%File complaint%', event: 'complaint_filed' },
    { pattern: '%Defendant served%', event: 'defendant_served' },
    { pattern: '%Serve defendant%', event: 'defendant_served' },
    { pattern: '%Discovery served%', event: 'discovery_served' },
    { pattern: '%Serve discovery%', event: 'discovery_served' },
    { pattern: '%Discovery received%', event: 'discovery_received' },
    { pattern: '%Settlement check%', event: 'settlement_sent' },
    { pattern: '%Payment info sent%', event: 'settlement_sent' },
  ];

  for (const m of mappings) {
    const res = await client.query(
      `UPDATE workflow_templates SET trigger_event = $1 WHERE title ILIKE $2 AND trigger_event IS NULL`,
      [m.event, m.pattern]
    );
    if (res.rowCount > 0) console.log(`Set ${m.event} on ${res.rowCount} templates matching "${m.pattern}"`);
  }

  // Verify
  const { rows } = await client.query(`SELECT id, title, trigger_event FROM workflow_templates WHERE trigger_event IS NOT NULL`);
  console.log('\nTemplates with trigger_event:');
  rows.forEach(r => console.log(`  ${r.trigger_event} → ${r.title}`));

  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
