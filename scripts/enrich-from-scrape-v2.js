/**
 * Enrich Supabase cases from Filevine V2 scraper output (all 7 sections).
 * Usage: node scripts/enrich-from-scrape-v2.js [--commit]
 * Default is DRY RUN.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const COMMIT = process.argv.includes('--commit');
const DATA_PATH = path.resolve(__dirname, '../data/filevine-full-data.json');

// ── Field mappings (lowercase label → column) ───────────────
const CASE_FIELD_MAP = {
  'insurer': 'insurer', 'insurance company': 'insurer', 'insurance carrier': 'insurer',
  'claim number': 'claim_number', 'claim #': 'claim_number',
  'policy number': 'policy_number', 'policy #': 'policy_number',
  'date of loss': 'date_of_loss', 'dol': 'date_of_loss',
  'statute of limitations': 'statute_of_limitations', 'sol': 'statute_of_limitations',
  'state': 'jurisdiction', 'jurisdiction': 'jurisdiction',
  'property address': 'property_address', 'loss address': 'property_address',
  'cause of loss': 'cause_of_loss',
  'adjuster name': 'adjuster_name', 'adjuster': 'adjuster_name',
  'adjuster phone': 'adjuster_phone', 'adjuster email': 'adjuster_email',
};

const CLAIM_DETAIL_MAP = {
  'policy type': 'policy_type', 'policy limits': 'policy_limits', 'deductible': 'deductible',
  'date reported': 'date_reported', 'date denied': 'date_denied',
  ...CASE_FIELD_MAP,
};

const LITIGATION_MAP = {
  'case number': 'case_number', 'court': 'court', 'judge': 'judge',
  'filed date': 'filed_date', 'date filed': 'filed_date',
  'opposing counsel': 'opposing_counsel', 'opposing firm': 'opposing_firm',
  'opposing phone': 'opposing_phone', 'opposing email': 'opposing_email',
  'trial date': 'trial_date', 'mediation date': 'mediation_date',
  'discovery deadline': 'discovery_deadline',
};

const NEGOTIATION_TYPE_MAP = {
  'bottom line': 'bottom_line', 'plaintiff offer': 'plaintiff_offer',
  'defendant offer': 'defendant_offer', 'presuit demand': 'presuit_demand',
  'settlement': 'settlement', 'undisputed payment': 'undisputed_payment',
  'denial': 'denial', 'appraisal award': 'appraisal_award',
};

const DATE_COLS = new Set(['date_of_loss', 'statute_of_limitations', 'date_reported', 'date_denied', 'filed_date', 'trial_date', 'mediation_date', 'discovery_deadline']);

// ── Name matching ───────────────────────────────────────────
function normalizeForMatch(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function extractClientName(projectName) {
  const vsplit = (projectName || '').split(/\s+v\.?\s+/i)[0].trim();
  const parts = vsplit.split(',').map(s => s.trim());
  if (parts.length >= 2) return normalizeForMatch(`${parts[1]} ${parts[0]}`);
  return normalizeForMatch(vsplit);
}

function namesMatch(scrapedProjectName, supabaseClientName) {
  const a = extractClientName(scrapedProjectName);
  const b = normalizeForMatch(supabaseClientName);
  if (!a || !b) return false;
  if (a === b) return true;
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

function extractFields(section, fieldMap) {
  const result = {};
  if (!section || !section.fields) return result;
  for (const [key, val] of Object.entries(section.fields)) {
    if (!val || typeof val !== 'string') continue;
    const col = fieldMap[key.toLowerCase().trim()];
    if (col) {
      result[col] = DATE_COLS.has(col) ? (parseDate(val) || undefined) : val.trim();
      if (result[col] === undefined) delete result[col];
    }
  }
  return result;
}

function extractNegotiations(section) {
  const negs = [];
  if (!section) return negs;
  // From tables (rows of negotiation data)
  if (section.tables) {
    for (const table of Object.values(section.tables)) {
      if (!Array.isArray(table)) continue;
      for (const row of table) {
        const neg = {};
        for (const [k, v] of Object.entries(row)) {
          const kl = k.toLowerCase().trim();
          if (kl === 'type' || kl === 'offer type') {
            neg.type = NEGOTIATION_TYPE_MAP[v.toLowerCase().trim()] || null;
          } else if (kl === 'amount') {
            neg.amount = parseFloat(v.replace(/[^0-9.-]/g, '')) || 0;
          } else if (kl === 'date') {
            neg.date = parseDate(v);
          } else if (kl === 'notes' || kl === 'description') {
            neg.notes = v;
          } else if (kl === 'by' || kl === 'by name') {
            neg.by_name = v;
          }
        }
        if (neg.type && neg.date) negs.push(neg);
      }
    }
  }
  return negs;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${COMMIT ? '🔴 COMMIT' : '🟡 DRY RUN (pass --commit to write)'}`);

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }
  const scraped = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`Loaded ${scraped.length} scraped entries`);

  const { data: cases, error } = await supabase.from('cases').select('id, ref, client_name, client_phone, client_email, insurer, claim_number, policy_number, date_of_loss, statute_of_limitations, jurisdiction, property_address, cause_of_loss, adjuster_name, adjuster_phone, adjuster_email');
  if (error) { console.error('Failed to load cases:', error); process.exit(1); }
  console.log(`Loaded ${cases.length} cases from Supabase`);

  const byRef = {};
  cases.forEach(c => { byRef[c.ref] = c; });

  let matched = 0, updated = 0, skipped = 0, negsCreated = 0;
  const unmatched = [];

  for (const entry of scraped) {
    const pid = String(entry.projectId);
    let caseRow = byRef[pid] || cases.find(c => namesMatch(entry.projectName, c.client_name));

    if (!caseRow) {
      unmatched.push({ projectId: pid, projectName: entry.projectName });
      continue;
    }
    matched++;

    const sections = entry.sections || {};

    // Build case updates from intake + insurance sections
    const caseUpdates = {};
    const intakeFields = extractFields(sections.intake, CASE_FIELD_MAP);
    const insuranceFields = extractFields(sections.insurance, CASE_FIELD_MAP);
    Object.assign(caseUpdates, intakeFields, insuranceFields);
    if (entry.clientPhone) caseUpdates.client_phone = entry.clientPhone;
    if (entry.clientEmail) caseUpdates.client_email = entry.clientEmail;

    // Claim details from intake + insurance
    const claimUpdates = {};
    Object.assign(claimUpdates, extractFields(sections.intake, CLAIM_DETAIL_MAP), extractFields(sections.insurance, CLAIM_DETAIL_MAP));

    // Litigation details from caseSummary
    const litUpdates = extractFields(sections.caseSummary, LITIGATION_MAP);

    // Negotiations
    const negotiations = extractNegotiations(sections.negotiations);

    // Filter case updates — only fill empty fields
    const filteredCaseUpdates = {};
    for (const [col, val] of Object.entries(caseUpdates)) {
      if (!caseRow[col] || caseRow[col] === '' || caseRow[col] === null) {
        filteredCaseUpdates[col] = val;
      }
    }

    const hasWork = Object.keys(filteredCaseUpdates).length > 0 || Object.keys(claimUpdates).length > 0 || Object.keys(litUpdates).length > 0 || negotiations.length > 0;
    if (!hasWork) { skipped++; continue; }

    console.log(`  ${caseRow.client_name} (${caseRow.ref}):`);
    if (Object.keys(filteredCaseUpdates).length) console.log(`    cases: ${Object.keys(filteredCaseUpdates).join(', ')}`);
    if (Object.keys(claimUpdates).length) console.log(`    claim_details: ${Object.keys(claimUpdates).join(', ')}`);
    if (Object.keys(litUpdates).length) console.log(`    litigation_details: ${Object.keys(litUpdates).join(', ')}`);
    if (negotiations.length) console.log(`    negotiations: ${negotiations.length} rows`);

    if (COMMIT) {
      if (Object.keys(filteredCaseUpdates).length) {
        const { error: e } = await supabase.from('cases').update(filteredCaseUpdates).eq('id', caseRow.id);
        if (e) console.error(`    ❌ cases: ${e.message}`);
      }
      if (Object.keys(claimUpdates).length) {
        await supabase.from('claim_details').upsert({ case_id: caseRow.id, ...claimUpdates }, { onConflict: 'case_id' });
      }
      if (Object.keys(litUpdates).length) {
        await supabase.from('litigation_details').upsert({ case_id: caseRow.id, ...litUpdates }, { onConflict: 'case_id' });
      }
      for (const neg of negotiations) {
        const { error: ne } = await supabase.from('negotiations').insert({ case_id: caseRow.id, ...neg });
        if (!ne) negsCreated++;
      }
    }
    updated++;
  }

  console.log('\n── Summary ──');
  console.log(`Total scraped: ${scraped.length}`);
  console.log(`Matched:       ${matched}`);
  console.log(`Updated:       ${updated}`);
  console.log(`Skipped:       ${skipped}`);
  console.log(`Unmatched:     ${unmatched.length}`);
  if (COMMIT) console.log(`Negotiations created: ${negsCreated}`);
  if (unmatched.length > 0) {
    console.log('\nUnmatched:');
    unmatched.forEach(u => console.log(`  - [${u.projectId}] ${u.projectName}`));
  }
  if (!COMMIT && updated > 0) console.log('\n⚠️  Re-run with --commit to write changes.');
}

main().catch(console.error);
