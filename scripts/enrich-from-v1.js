/**
 * Enrich Supabase cases from Filevine V1 scraped data.
 * Usage: node scripts/enrich-from-v1.js [--commit]
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

function parseDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  return null;
}

function cleanPhone(s) {
  if (!s) return null;
  return s.replace(/^.*slot-text:\S+\s*/, '').replace(/[^\d()+\-.\sEext]/gi, '').trim() || null;
}

function cleanEmail(s) {
  if (!s) return null;
  const cleaned = s.replace(/^.*slot-text:\S+\s*/, '').trim();
  return cleaned.includes('@') ? cleaned : null;
}

function mapState(s) {
  const map = {
    'Kentucky':'KY','Tennessee':'TN','Texas':'TX','Montana':'MT','Arizona':'AZ',
    'Indiana':'IN','Nebraska':'NE','Ohio':'OH','South Carolina':'SC','Colorado':'CO',
    'North Carolina':'NC','Michigan':'MI','Wyoming':'WY','Washington':'WA',
    'Missouri':'MO',
  };
  return s ? (map[s] || s) : null;
}

async function main() {
  console.log(COMMIT ? '🔥 COMMIT MODE' : '🔍 DRY RUN — pass --commit to write');

  const { data: existing, error } = await supabase
    .from('cases')
    .select('id, ref, client_name, client_phone, client_email, type, status, jurisdiction, insurer, claim_number, policy_number, date_of_loss, date_opened');
  
  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`DB cases: ${existing.length} | Scraped: ${scraped.length}\n`);

  // Match by client_name (which was set from projectName during migration)
  const nameMap = new Map();
  existing.forEach(c => {
    const key = c.client_name?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key) nameMap.set(key, c);
  });

  let matched = 0, updated = 0, skipped = 0;
  const updates = [];

  for (const sc of scraped) {
    const scKey = sc.projectName?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = nameMap.get(scKey);
    if (!match) { skipped++; continue; }
    matched++;

    const patch = {};

    // Insurer
    if (sc['Insurance Company Name'] && (!match.insurer || match.insurer === 'TBD'))
      patch.insurer = sc['Insurance Company Name'];

    // Jurisdiction
    const state = mapState(sc['Insured Property State']);
    if (state && (!match.jurisdiction || match.jurisdiction === 'KY'))
      patch.jurisdiction = state;

    // Claim/policy
    if (sc.claimnumber && !match.claim_number) patch.claim_number = sc.claimnumber;
    if (sc.policynumber && !match.policy_number) patch.policy_number = sc.policynumber;

    // Date of loss
    const dol = parseDate(sc['Date of Loss']);
    if (dol && !match.date_of_loss) patch.date_of_loss = dol;

    // Date opened from intake
    const doi = parseDate(sc['Date of Intake']);
    if (doi && !match.date_opened) patch.date_opened = doi;

    // Type from loss type
    const lossType = (sc['Type of Loss'] || '').toLowerCase();
    if (lossType && (!match.type || match.type === 'Property')) {
      const typeMap = { fire:'Fire', water:'Water', wind:'Wind', hail:'Hail', other:'Other' };
      if (typeMap[lossType]) patch.type = typeMap[lossType];
    }

    // Client contact info
    const phone = cleanPhone(sc.clientPhone);
    if (phone && !match.client_phone) patch.client_phone = phone;
    const email = cleanEmail(sc.clientEmail);
    if (email && !match.client_email) patch.client_email = email;

    if (Object.keys(patch).length === 0) continue;
    updated++;
    updates.push({ id: match.id, name: match.client_name, patch });

    if (!COMMIT) {
      console.log(`  ✏️  ${match.client_name}`);
      Object.entries(patch).forEach(([k,v]) => console.log(`      ${k}: ${v}`));
    }
  }

  console.log(`\nMatched: ${matched} | To update: ${updated} | No match: ${skipped}`);

  if (COMMIT && updates.length > 0) {
    let ok = 0, fail = 0;
    for (const u of updates) {
      const { error } = await supabase.from('cases').update(u.patch).eq('id', u.id);
      if (error) { console.error(`  ❌ ${u.name}: ${error.message}`); fail++; }
      else { ok++; }
    }
    console.log(`\n✅ ${ok} updated, ❌ ${fail} failed`);
  }
}

main();
