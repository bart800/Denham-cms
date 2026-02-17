/**
 * Enrich Supabase cases from Filevine V2 full scraper output.
 * Reads data/filevine-full-data.json, matches to existing cases by client_name,
 * and updates cases + populates claim_details, litigation_details.
 *
 * Usage: node scripts/enrich-from-v2.js [--commit]
 */
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMMIT = process.argv.includes('--commit');
const DATA_PATH = path.resolve(__dirname, '../data/filevine-full-data.json');

// ── Helpers ──────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normSpaces(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function parseDate(s) {
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function cleanPhone(s) {
  if (!s) return null;
  const cleaned = s.replace(/^.*slot-text:\S+\s*/, '').replace(/[^\d()+\-.\sEext]/gi, '').trim();
  return cleaned.length >= 7 ? cleaned : null;
}

function cleanEmail(s) {
  if (!s) return null;
  const cleaned = s.replace(/^.*slot-text:\S+\s*/, '').trim();
  return cleaned.includes('@') ? cleaned : null;
}

function f(sections, sectionName, ...fieldNames) {
  const sec = sections?.[sectionName];
  if (!sec?.fields) return null;
  for (const fn of fieldNames) {
    const v = sec.fields[fn];
    if (v !== undefined && v !== null && String(v).trim() !== '' && !String(v).startsWith('? string:')) {
      return String(v).trim();
    }
  }
  return null;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

const STATE_MAP = {
  'kentucky':'KY','tennessee':'TN','texas':'TX','montana':'MT','arizona':'AZ',
  'indiana':'IN','nebraska':'NE','ohio':'OH','south carolina':'SC','colorado':'CO',
  'north carolina':'NC','michigan':'MI','wyoming':'WY','washington':'WA','missouri':'MO',
  'california':'CA','new york':'NY','florida':'FL','georgia':'GA','virginia':'VA',
  'alabama':'AL','mississippi':'MS','louisiana':'LA','illinois':'IL','pennsylvania':'PA',
  'west virginia':'WV','arkansas':'AR','iowa':'IA','minnesota':'MN','wisconsin':'WI',
  'connecticut':'CT','new jersey':'NJ','maryland':'MD','new hampshire':'NH',
};

function mapState(s) {
  if (!s) return null;
  s = s.trim();
  if (s.length === 2) return s.toUpperCase();
  return STATE_MAP[s.toLowerCase()] || null;
}

function parseAmount(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

const VALID_JURISDICTIONS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]);

// ── Matching ─────────────────────────────────────────────────

function findMatch(projectName, dbCases) {
  if (!projectName) return null;
  const pn = normSpaces(projectName);
  const pnStripped = normalize(projectName);
  
  // 1. Exact normalized match
  let found = dbCases.find(c => normalize(c.client_name) === pnStripped);
  if (found) return found;
  
  // 2. DB name contained in project name (min 4 chars to avoid false matches)
  found = dbCases.find(c => {
    const cn = normSpaces(c.client_name);
    return cn.length > 3 && pn.includes(cn);
  });
  if (found) return found;
  
  // 3. First word match (unique)
  const pw = pn.split(/\s+/)[0];
  if (pw.length > 3) {
    const matches = dbCases.filter(c => normSpaces(c.client_name).split(/\s+/)[0] === pw);
    if (matches.length === 1) return matches[0];
  }
  
  return null;
}

// ── Field Extraction ─────────────────────────────────────────

function extractCasePatch(sc, existing) {
  const s = sc.sections || {};
  const patch = {};

  // Client contact
  const phone = cleanPhone(sc.clientPhone);
  if (phone && !existing.client_phone) patch.client_phone = phone;

  const email = cleanEmail(sc.clientEmail);
  if (email && !existing.client_email) patch.client_email = email;

  // Insurer (intake has "Insurance Company Name")
  const insurer = firstNonEmpty(
    f(s, 'intake', 'Insurance Company Name', 'Insurance Company'),
    f(s, 'insurance', 'Insurance Company Name', 'Insurance Company'),
    f(s, 'caseSummary', 'Insurance Company Name', 'Insurance Company'),
  );
  if (insurer && (!existing.insurer || existing.insurer === 'TBD')) patch.insurer = insurer;

  // Claim/policy numbers (intake has lowercase keys)
  const claimNum = firstNonEmpty(
    f(s, 'intake', 'claimnumber', 'Claim Number'),
    f(s, 'insurance', 'claimnumber', 'Claim Number'),
  );
  if (claimNum && !existing.claim_number) patch.claim_number = claimNum;

  const policyNum = firstNonEmpty(
    f(s, 'intake', 'policynumber', 'Policy Number'),
    f(s, 'insurance', 'policynumber', 'Policy Number'),
  );
  if (policyNum && !existing.policy_number) patch.policy_number = policyNum;

  // Date of loss
  const dol = parseDate(firstNonEmpty(
    f(s, 'intake', 'Date of Loss'),
    f(s, 'caseSummary', 'Date of Loss'),
  ));
  if (dol && !existing.date_of_loss) patch.date_of_loss = dol;

  // Date opened (from intake date)
  const doi = parseDate(firstNonEmpty(
    f(s, 'intake', 'Date of Intake', 'Date Opened'),
  ));
  if (doi && !existing.date_opened) patch.date_opened = doi;

  // Statute of limitations (caseSummary "Due" field is the SOL date!)
  const sol = parseDate(firstNonEmpty(
    f(s, 'caseSummary', 'Due'),
  ));
  if (sol && !existing.statute_of_limitations) patch.statute_of_limitations = sol;

  // Jurisdiction / state
  const state = mapState(firstNonEmpty(
    f(s, 'intake', 'Insured Property State'),
  ));
  if (state && VALID_JURISDICTIONS.has(state) && (!existing.jurisdiction || existing.jurisdiction === 'KY')) {
    // Only update if it's actually different from the default
    if (state !== 'KY' || !existing.jurisdiction) patch.jurisdiction = state;
  }

  // Type / cause of loss
  const lossType = firstNonEmpty(
    f(s, 'intake', 'Type of Loss'),
    f(s, 'caseSummary', 'Type of Loss'),
  );
  if (lossType) {
    const causeDetail = firstNonEmpty(
      f(s, 'intake', 'causeofloss', 'Cause of Loss'),
      f(s, 'intake', 'typeofloss'),
    );
    if (causeDetail && !existing.cause_of_loss) patch.cause_of_loss = causeDetail;
    
    const typeMap = { 'fire':'Fire', 'water':'Water', 'wind':'Wind', 'hail':'Hail', 'other':'Other' };
    const mapped = typeMap[lossType.toLowerCase()];
    if (mapped && (!existing.type || existing.type === 'Other')) patch.type = mapped;
  }

  // Property address (intake has lowercase key)
  const propAddr = firstNonEmpty(
    f(s, 'intake', 'insuredpropertyaddress', 'Insured Property Address', 'Property Address'),
  );
  if (propAddr && !existing.property_address) patch.property_address = propAddr;

  // Adjuster info
  const adjName = firstNonEmpty(
    f(s, 'intake', 'Adjuster', 'Adjuster Name'),
    f(s, 'insurance', 'Adjuster', 'Adjuster Name'),
  );
  if (adjName && !existing.adjuster_name) patch.adjuster_name = adjName;

  const adjPhone = cleanPhone(firstNonEmpty(
    f(s, 'intake', 'Adjuster Phone'),
    f(s, 'insurance', 'Adjuster Phone'),
  ));
  if (adjPhone && !existing.adjuster_phone) patch.adjuster_phone = adjPhone;

  const adjEmail = cleanEmail(firstNonEmpty(
    f(s, 'intake', 'Adjuster Email'),
    f(s, 'insurance', 'Adjuster Email'),
  ));
  if (adjEmail && !existing.adjuster_email) patch.adjuster_email = adjEmail;

  return patch;
}

function extractClaimDetails(sc, caseId) {
  // Schema: case_id, policy_number, claim_number, insurer, adjuster_name, adjuster_phone,
  //         adjuster_email, date_of_loss, date_reported, date_denied, policy_type,
  //         policy_limits, deductible, cause_of_loss, property_address
  const s = sc.sections || {};
  const cd = { case_id: caseId };

  cd.policy_number = firstNonEmpty(f(s, 'intake', 'policynumber', 'Policy Number'));
  cd.claim_number = firstNonEmpty(f(s, 'intake', 'claimnumber', 'Claim Number'));
  cd.insurer = firstNonEmpty(f(s, 'intake', 'Insurance Company Name', 'Insurance Company'));
  cd.adjuster_name = firstNonEmpty(f(s, 'intake', 'Adjuster', 'Adjuster Name'));
  cd.adjuster_phone = cleanPhone(f(s, 'intake', 'Adjuster Phone'));
  cd.adjuster_email = cleanEmail(f(s, 'intake', 'Adjuster Email'));
  cd.date_of_loss = parseDate(f(s, 'intake', 'Date of Loss'));
  cd.policy_type = firstNonEmpty(f(s, 'intake', 'Policy Type'));
  cd.deductible = firstNonEmpty(f(s, 'intake', 'deductible', 'Deductible'));
  cd.cause_of_loss = firstNonEmpty(f(s, 'intake', 'causeofloss', 'Cause of Loss'));
  cd.property_address = firstNonEmpty(f(s, 'intake', 'insuredpropertyaddress', 'Property Address'));
  // policy_limits: compose from coverage fields
  const dwelling = f(s, 'intake', 'Dwelling');
  const contents = f(s, 'intake', 'Contents');
  if (dwelling || contents) {
    const parts = [];
    if (dwelling) parts.push(`Dwelling: $${dwelling}`);
    const os = f(s, 'intake', 'Other Structure');
    if (os) parts.push(`Other Structure: $${os}`);
    if (contents) parts.push(`Contents: $${contents}`);
    const ale = f(s, 'intake', 'ALE');
    if (ale) parts.push(`ALE: $${ale}`);
    cd.policy_limits = parts.join('; ');
  }

  for (const k of Object.keys(cd)) {
    if (cd[k] === null || cd[k] === undefined) delete cd[k];
  }
  return Object.keys(cd).length > 1 ? cd : null;
}

function extractLitigationDetails(sc, caseId) {
  // Schema: case_id, case_number, court, judge, filed_date, opposing_counsel,
  //         opposing_firm, opposing_phone, opposing_email, trial_date,
  //         mediation_date, discovery_deadline
  const s = sc.sections || {};
  const ld = { case_id: caseId };

  ld.case_number = firstNonEmpty(f(s, 'caseSummary', 'courtcasenumber'));
  ld.court = firstNonEmpty(f(s, 'caseSummary', 'Court'));
  ld.judge = firstNonEmpty(f(s, 'caseSummary', 'Judge'));
  ld.filed_date = parseDate(f(s, 'caseSummary', 'Complaint Filed'));
  ld.opposing_counsel = firstNonEmpty(f(s, 'caseSummary', 'Opposing Counsel'));

  for (const k of Object.keys(ld)) {
    if (ld[k] === null || ld[k] === undefined) delete ld[k];
  }
  return Object.keys(ld).length > 1 ? ld : null;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(COMMIT ? '🔥 COMMIT MODE — writing to Supabase' : '🔍 DRY RUN — pass --commit to write\n');

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const scraped = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`📂 Loaded ${scraped.length} cases from filevine-full-data.json`);

  const { data: existing, error } = await supabase.from('cases').select('*');
  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`📊 ${existing.length} cases in Supabase\n`);

  // Check existing related tables
  const { data: existingClaims } = await supabase.from('claim_details').select('case_id');
  const { data: existingLit } = await supabase.from('litigation_details').select('case_id');
  const claimCaseIds = new Set((existingClaims || []).map(r => r.case_id));
  const litCaseIds = new Set((existingLit || []).map(r => r.case_id));

  let matched = 0, skipped = 0;
  const caseUpdates = [];
  const claimInserts = [];
  const litInserts = [];

  for (const sc of scraped) {
    const match = findMatch(sc.projectName, existing);
    if (!match) { skipped++; continue; }
    matched++;

    // Case updates
    const patch = extractCasePatch(sc, match);
    if (Object.keys(patch).length > 0) {
      caseUpdates.push({ id: match.id, name: match.client_name, patch });
    }

    // Claim details
    if (!claimCaseIds.has(match.id)) {
      const cd = extractClaimDetails(sc, match.id);
      if (cd) claimInserts.push({ name: match.client_name, data: cd });
    }

    // Litigation details
    if (!litCaseIds.has(match.id)) {
      const ld = extractLitigationDetails(sc, match.id);
      if (ld) litInserts.push({ name: match.client_name, data: ld });
    }
  }

  // ── Report ──────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  ENRICHMENT REPORT');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`  Matched:    ${matched}/${scraped.length}`);
  console.log(`  No match:   ${skipped}\n`);

  // Summarize case updates by field
  const fieldCounts = {};
  for (const u of caseUpdates) {
    for (const k of Object.keys(u.patch)) {
      fieldCounts[k] = (fieldCounts[k] || 0) + 1;
    }
  }
  if (caseUpdates.length) {
    console.log(`📝 CASE UPDATES: ${caseUpdates.length} cases`);
    for (const [k, v] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${k}: ${v} cases`);
    }
    console.log();
  }

  if (claimInserts.length) {
    console.log(`📋 CLAIM DETAILS: ${claimInserts.length} new rows`);
    const avgFields = Math.round(claimInserts.reduce((a, c) => a + Object.keys(c.data).length - 1, 0) / claimInserts.length);
    console.log(`   Average ${avgFields} fields per row\n`);
  }

  if (litInserts.length) {
    console.log(`⚖️  LITIGATION DETAILS: ${litInserts.length} new rows`);
    const avgFields = Math.round(litInserts.reduce((a, c) => a + Object.keys(c.data).length - 1, 0) / litInserts.length);
    console.log(`   Average ${avgFields} fields per row\n`);
  }

  const totalChanges = caseUpdates.length + claimInserts.length + litInserts.length;
  if (totalChanges === 0) {
    console.log('✅ Nothing to update.');
    return;
  }

  if (!COMMIT) {
    console.log(`\n💡 ${totalChanges} total operations. Run with --commit to apply.`);
    return;
  }

  // ── Commit ──────────────────────────────────────────────────
  console.log('\n🔥 Committing changes...\n');
  let ok = 0, fail = 0;

  for (const u of caseUpdates) {
    const { error } = await supabase.from('cases').update(u.patch).eq('id', u.id);
    if (error) { console.error(`  ❌ cases/${u.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  for (const ci of claimInserts) {
    const { error } = await supabase.from('claim_details').insert(ci.data);
    if (error) { console.error(`  ❌ claim_details/${ci.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  for (const li of litInserts) {
    const { error } = await supabase.from('litigation_details').insert(li.data);
    if (error) { console.error(`  ❌ litigation_details/${li.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  console.log(`\n✅ ${ok} succeeded, ❌ ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
