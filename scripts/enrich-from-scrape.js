/**
 * Enrich Supabase cases from Filevine V1 scraper output.
 * Usage: node scripts/enrich-from-scrape.js [--commit]
 * Default is DRY RUN — pass --commit to write to Supabase.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const COMMIT = process.argv.includes('--commit');
const DATA_PATH = path.resolve(__dirname, '../data/filevine-detailed-data.json');

// ── Field mappings ──────────────────────────────────────────
const FIELD_MAP = {
  // key = lowercase scraped field label → supabase column
  'insurer': 'insurer',
  'insurance company': 'insurer',
  'insurance carrier': 'insurer',
  'claim number': 'claim_number',
  'claim #': 'claim_number',
  'policy number': 'policy_number',
  'policy #': 'policy_number',
  'date of loss': 'date_of_loss',
  'dol': 'date_of_loss',
  'statute of limitations': 'statute_of_limitations',
  'sol': 'statute_of_limitations',
  'state': 'jurisdiction',
  'jurisdiction': 'jurisdiction',
  'property address': 'property_address',
  'loss address': 'property_address',
  'cause of loss': 'cause_of_loss',
  'adjuster name': 'adjuster_name',
  'adjuster': 'adjuster_name',
  'adjuster phone': 'adjuster_phone',
  'adjuster email': 'adjuster_email',
};

// Date columns that need parsing
const DATE_COLS = new Set(['date_of_loss', 'statute_of_limitations']);

// ── Name matching ───────────────────────────────────────────
function normalizeForMatch(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function extractClientName(projectName) {
  // "LastName, FirstName v. Insurer" → "firstname lastname"
  const vsplit = (projectName || '').split(/\s+v\.?\s+/i)[0].trim();
  const parts = vsplit.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    return normalizeForMatch(`${parts[1]} ${parts[0]}`);
  }
  return normalizeForMatch(vsplit);
}

function namesMatch(scrapedProjectName, supabaseClientName) {
  const a = extractClientName(scrapedProjectName);
  const b = normalizeForMatch(supabaseClientName);
  if (!a || !b) return false;
  if (a === b) return true;
  // Check if all words from one appear in the other
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  return aWords.every(w => bWords.includes(w)) || bWords.every(w => aWords.includes(w));
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// ── Map scraped entry to update object ──────────────────────
function mapFields(entry) {
  const updates = {};
  // Direct fields
  if (entry.clientPhone) updates.client_phone = entry.clientPhone;
  if (entry.clientEmail) updates.client_email = entry.clientEmail;

  // Iterate scraped fields (could be flat keys or nested)
  const fields = entry.fields || entry.intakeFields || entry;
  for (const [key, val] of Object.entries(fields)) {
    if (!val || typeof val !== 'string' || key === 'projectId' || key === 'projectName' || key === 'clientPhone' || key === 'clientEmail') continue;
    const col = FIELD_MAP[key.toLowerCase().trim()];
    if (col) {
      if (DATE_COLS.has(col)) {
        const parsed = parseDate(val);
        if (parsed) updates[col] = parsed;
      } else {
        updates[col] = val.trim();
      }
    }
  }
  return updates;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${COMMIT ? '🔴 COMMIT (writing to Supabase)' : '🟡 DRY RUN (pass --commit to write)'}`);

  // Load scraped data
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }
  const scraped = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`Loaded ${scraped.length} scraped entries`);

  // Load all cases from Supabase
  const { data: cases, error } = await supabase.from('cases').select('id, ref, client_name, client_phone, client_email, insurer, claim_number, policy_number, date_of_loss, statute_of_limitations, jurisdiction, property_address, cause_of_loss, adjuster_name, adjuster_phone, adjuster_email');
  if (error) { console.error('Failed to load cases:', error); process.exit(1); }
  console.log(`Loaded ${cases.length} cases from Supabase`);

  // Build lookup by ref (Filevine project ID)
  const byRef = {};
  cases.forEach(c => { byRef[c.ref] = c; });

  let matched = 0, updated = 0, skipped = 0;
  const unmatched = [];

  for (const entry of scraped) {
    const pid = String(entry.projectId);
    // Try match by ref first, then by name
    let caseRow = byRef[pid];
    if (!caseRow) {
      caseRow = cases.find(c => namesMatch(entry.projectName, c.client_name));
    }

    if (!caseRow) {
      unmatched.push({ projectId: pid, projectName: entry.projectName });
      continue;
    }
    matched++;

    const updates = mapFields(entry);
    // Also populate claim_details
    const claimUpdates = {};
    for (const col of ['property_address', 'cause_of_loss', 'adjuster_name', 'adjuster_phone', 'adjuster_email']) {
      if (updates[col]) claimUpdates[col] = updates[col];
    }
    if (updates.insurer) claimUpdates.insurer = updates.insurer;
    if (updates.claim_number) claimUpdates.claim_number = updates.claim_number;
    if (updates.policy_number) claimUpdates.policy_number = updates.policy_number;
    if (updates.date_of_loss) claimUpdates.date_of_loss = updates.date_of_loss;

    // Filter out fields that already have values
    const caseUpdates = {};
    for (const [col, val] of Object.entries(updates)) {
      if (!caseRow[col] || caseRow[col] === '' || caseRow[col] === null) {
        caseUpdates[col] = val;
      }
    }

    if (Object.keys(caseUpdates).length === 0) {
      skipped++;
      continue;
    }

    console.log(`  ${caseRow.client_name} (${caseRow.ref}): updating ${Object.keys(caseUpdates).join(', ')}`);

    if (COMMIT) {
      const { error: updateErr } = await supabase.from('cases').update(caseUpdates).eq('id', caseRow.id);
      if (updateErr) {
        console.error(`    ❌ Failed: ${updateErr.message}`);
        continue;
      }
      // Upsert claim_details too
      if (Object.keys(claimUpdates).length > 0) {
        await supabase.from('claim_details').upsert({ case_id: caseRow.id, ...claimUpdates }, { onConflict: 'case_id' });
      }
    }
    updated++;
  }

  console.log('\n── Summary ──');
  console.log(`Total scraped: ${scraped.length}`);
  console.log(`Matched:       ${matched}`);
  console.log(`Updated:       ${updated}`);
  console.log(`Skipped (no new data): ${skipped}`);
  console.log(`Unmatched:     ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('\nUnmatched entries:');
    unmatched.forEach(u => console.log(`  - [${u.projectId}] ${u.projectName}`));
  }
  if (!COMMIT && updated > 0) {
    console.log('\n⚠️  Re-run with --commit to write changes to Supabase.');
  }
}

main().catch(console.error);
