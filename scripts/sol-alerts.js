const { Client } = require('pg');

const PG_CONFIG = {
  host: 'db.amyttoowrroajffqubpd.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'f5fIQC4B8KaqcDH4',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const client = new Client(PG_CONFIG);
  await client.connect();

  // Query active cases with SOL within 90 days OR expired
  const { rows } = await client.query(`
    SELECT id, client_name, ref, statute_of_limitations, status,
           (statute_of_limitations - CURRENT_DATE) AS days_remaining
    FROM cases
    WHERE statute_of_limitations IS NOT NULL
      AND COALESCE(status, '') NOT IN ('Settled', 'Closed')
      AND statute_of_limitations <= CURRENT_DATE + INTERVAL '90 days'
    ORDER BY statute_of_limitations ASC
  `);

  await client.end();

  // Group by urgency
  const expired = [];
  const critical = [];
  const warning = [];
  const upcoming = [];

  for (const row of rows) {
    const days = parseInt(row.days_remaining);
    const entry = {
      id: row.id,
      name: row.client_name,
      case_number: row.ref,
      sol: row.statute_of_limitations,
      status: row.status,
      days
    };
    if (days < 0) expired.push(entry);
    else if (days <= 14) critical.push(entry);
    else if (days <= 30) warning.push(entry);
    else upcoming.push(entry);
  }

  // Format Slack message
  const lines = [];
  lines.push('⚖️ *SOL Deadline Alerts* — ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  lines.push('');

  const formatCase = (c) => {
    const solDate = new Date(c.sol).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const label = c.case_number ? `${c.name} (${c.case_number})` : c.name;
    const daysText = c.days === 0 ? '*TODAY*' : c.days === 1 ? '1 day' : `${Math.abs(c.days)} days`;
    return `  • ${label} — ${solDate} (${c.days < 0 ? daysText + ' overdue' : c.days === 0 ? daysText : daysText + ' left'})`;
  };

  if (expired.length) {
    lines.push(`🚨 *EXPIRED* (${expired.length}):`);
    expired.forEach(c => lines.push(formatCase(c)));
    lines.push('');
  }

  if (critical.length) {
    lines.push(`🔴 *CRITICAL — 14 days or less* (${critical.length}):`);
    critical.forEach(c => lines.push(formatCase(c)));
    lines.push('');
  }

  if (warning.length) {
    lines.push(`🟡 *WARNING — 15-30 days* (${warning.length}):`);
    warning.forEach(c => lines.push(formatCase(c)));
    lines.push('');
  }

  if (upcoming.length) {
    lines.push(`🟢 *UPCOMING — 31-90 days* (${upcoming.length}):`);
    upcoming.forEach(c => lines.push(formatCase(c)));
    lines.push('');
  }

  if (!rows.length) {
    lines.push('✅ No SOL deadlines in the next 90 days. All clear!');
  }

  const totalAlerts = expired.length + critical.length + warning.length + upcoming.length;
  if (totalAlerts) {
    lines.push(`_${totalAlerts} total cases with upcoming SOL deadlines_`);
  }

  // Output JSON for programmatic use
  const jsonOutput = { expired, critical, warning, upcoming, generated: new Date().toISOString() };

  // If --json flag, output JSON; otherwise Slack message
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    console.log(lines.join('\n'));
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
