/**
 * Update `type` column in Supabase cases to store loss type (Fire/Water/Wind/Hail/Other).
 * Usage: node scripts/update-loss-types.js [--commit]
 */
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMMIT = process.argv.includes('--commit');
const scraped = require('../data/filevine-scraped-v1.json');

function normalizeLossType(raw) {
  if (!raw) return 'Other';
  const l = raw.toLowerCase();
  if (l.includes('fire')) return 'Fire';
  if (l.includes('water') || l.includes('flood')) return 'Water';
  if (l.includes('hail')) return 'Hail';
  if (l.includes('wind') || l.includes('wid')) return 'Wind';
  return 'Other';
}

async function main() {
  console.log(COMMIT ? '🔥 COMMIT MODE' : '🔍 DRY RUN — pass --commit to write');

  const { data: existing, error } = await supabase
    .from('cases')
    .select('id, client_name, type');

  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`DB cases: ${existing.length} | Scraped: ${scraped.length}\n`);

  const nameMap = new Map();
  existing.forEach(c => {
    const key = c.client_name?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key) nameMap.set(key, c);
  });

  const typeCounts = {};
  let matched = 0, skipped = 0;
  const updates = [];

  for (const sc of scraped) {
    const scKey = sc.projectName?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = nameMap.get(scKey);
    if (!match) { skipped++; continue; }
    matched++;

    const lossType = normalizeLossType(sc['Type of Loss']);
    typeCounts[lossType] = (typeCounts[lossType] || 0) + 1;

    if (match.type !== lossType) {
      updates.push({ id: match.id, name: match.client_name, from: match.type, to: lossType });
    }
  }

  console.log('Loss type distribution:', typeCounts);
  console.log(`Matched: ${matched} | To update: ${updates.length} | No match: ${skipped}\n`);

  if (!COMMIT) {
    updates.slice(0, 20).forEach(u => console.log(`  ${u.name}: "${u.from}" → "${u.to}"`));
    if (updates.length > 20) console.log(`  ... and ${updates.length - 20} more`);
    return;
  }

  let ok = 0, fail = 0;
  for (const u of updates) {
    const { error } = await supabase.from('cases').update({ type: u.to }).eq('id', u.id);
    if (error) { console.error(`  ❌ ${u.name}: ${error.message}`); fail++; }
    else ok++;
  }
  console.log(`✅ ${ok} updated, ❌ ${fail} failed`);
}

main();
