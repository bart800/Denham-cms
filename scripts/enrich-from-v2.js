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
  const s = sc.sections || {};
  const cd = { case_id: caseId };

  // Original columns
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

  // Claim status & loss details
  cd.claim_status = firstNonEmpty(f(s, 'intake', 'Claim Status', 'claimstatus'));
  cd.type_of_loss = firstNonEmpty(f(s, 'intake', 'Type of Loss'));
  cd.type_of_loss_detail = firstNonEmpty(f(s, 'intake', 'typeofloss'));
  cd.areas_of_damage = firstNonEmpty(f(s, 'intake', 'areasofdamagepleaselistallareasofd'));
  cd.how_noticed_damage = firstNonEmpty(f(s, 'intake', 'howdidyounoticethedamage'));

  // Property location
  cd.insured_property_state = firstNonEmpty(f(s, 'intake', 'Insured Property State'));
  cd.insured_property_zip = firstNonEmpty(f(s, 'intake', 'insuredpropertyzipcode'));
  cd.insured_county = firstNonEmpty(f(s, 'intake', 'county'));

  // Coverage (A=Dwelling, B=Other Structure, C=Contents, ALE)
  cd.coverage_dwelling = parseAmount(f(s, 'intake', 'Dwelling'));
  cd.coverage_other_structure = parseAmount(f(s, 'intake', 'Other Structure'));
  cd.coverage_contents = parseAmount(f(s, 'intake', 'Contents'));
  cd.coverage_ale = parseAmount(f(s, 'intake', 'ALE'));
  cd.coverage_loss_of_income = parseAmount(f(s, 'intake', 'Loss of Income'));
  cd.policy_period_start = parseDate(f(s, 'intake', 'Policy Period Start'));
  cd.policy_period_end = parseDate(f(s, 'intake', 'Policy Period End'));

  // Other insured / defendant
  cd.other_insured = firstNonEmpty(f(s, 'intake', 'Other Insured'));
  cd.defendant = firstNonEmpty(f(s, 'intake', 'Defendant'));

  // Mortgage
  cd.mortgage_company = firstNonEmpty(f(s, 'intake', 'Mortgage Company'));

  // Estimates
  cd.estimate_total = parseAmount(f(s, 'intake', 'Estimate for Total Damages'));
  cd.estimate_interior = parseAmount(f(s, 'intake', 'Estimate for Interior Damages'));
  cd.estimate_date = parseDate(f(s, 'intake', 'Date of Estimate'));

  // Payments
  cd.amount_of_payments = firstNonEmpty(f(s, 'intake', 'amountofpayments', 'Amount of Payment(s)'));

  // Prior claims
  cd.prior_claim_date = firstNonEmpty(f(s, 'intake', 'whendidyoufileapriorclaim'));
  cd.prior_claim_with = firstNonEmpty(f(s, 'intake', 'whodidyoufileapriorclaimwith'));
  cd.prior_claim_reason = firstNonEmpty(f(s, 'intake', 'whydidyoufileapriorclaim'));

  // Property info
  cd.property_purchased_date = firstNonEmpty(f(s, 'intake', 'whenwasthepropertypurchased'));
  cd.roof_age = firstNonEmpty(f(s, 'intake', 'howoldistheroof'));

  // Intake/referral
  cd.date_of_intake = parseDate(f(s, 'intake', 'Date of Intake'));
  cd.intake_coordinator = firstNonEmpty(f(s, 'intake', 'Intake Coordinator'));
  cd.intake_status = firstNonEmpty(f(s, 'intake', 'Intake Status'));
  cd.marketing_source = firstNonEmpty(f(s, 'intake', 'Marketing Source'));
  cd.referring_attorney = firstNonEmpty(f(s, 'intake', 'Referring Attorney'));
  cd.referring_pa = firstNonEmpty(f(s, 'intake', 'Referring Public Adjuster'));
  cd.referring_contractor = firstNonEmpty(f(s, 'intake', 'Referring Contractor'));
  cd.referring_client = firstNonEmpty(f(s, 'intake', 'Referring Client'));
  cd.additional_information = firstNonEmpty(f(s, 'intake', 'additionalinformation'));

  // Also store policy_limits as composed string for backwards compat
  const dw = f(s, 'intake', 'Dwelling');
  const ct = f(s, 'intake', 'Contents');
  if (dw || ct) {
    const parts = [];
    if (dw) parts.push(`A/Dwelling: $${dw}`);
    const os = f(s, 'intake', 'Other Structure');
    if (os) parts.push(`B/Other Structure: $${os}`);
    if (ct) parts.push(`C/Contents: $${ct}`);
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
  const s = sc.sections || {};
  const ld = { case_id: caseId };

  // Original columns
  ld.case_number = firstNonEmpty(f(s, 'caseSummary', 'courtcasenumber'));
  ld.court = firstNonEmpty(f(s, 'caseSummary', 'Court'));
  ld.judge = firstNonEmpty(f(s, 'caseSummary', 'Judge'));
  ld.filed_date = parseDate(f(s, 'caseSummary', 'Complaint Filed'));
  ld.opposing_counsel = firstNonEmpty(f(s, 'caseSummary', 'Opposing Counsel'));

  // New expanded columns
  ld.court_caption = firstNonEmpty(f(s, 'caseSummary', 'courtcaptionieinthecircuitcourtoft'));
  ld.plaintiff_caption = firstNonEmpty(f(s, 'caseSummary', 'plaintiffcaption'));
  ld.defendant_caption = firstNonEmpty(f(s, 'caseSummary', 'defendantcaption'));
  ld.case_description = firstNonEmpty(f(s, 'caseSummary', 'casedescription'));
  ld.contract_signed = parseDate(f(s, 'caseSummary', 'Date Contract Signed'));
  ld.completed_date = parseDate(f(s, 'caseSummary', 'Done'));
  ld.primary_attorney = firstNonEmpty(f(s, 'caseSummary', 'Primary Attorney'));
  ld.secondary_attorney = firstNonEmpty(f(s, 'caseSummary', 'Secondary Attorney'));
  ld.support_staff = firstNonEmpty(f(s, 'caseSummary', 'Support'));
  ld.sol_date = parseDate(f(s, 'caseSummary', 'Due'));
  ld.sol_basis = firstNonEmpty(f(s, 'caseSummary', 'Basis for SOL'));
  ld.certificate_of_service = firstNonEmpty(f(s, 'caseSummary', 'certificateofservice'));

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
  const claimUpdates = [];
  const litInserts = [];
  const litUpdates = [];

  for (const sc of scraped) {
    const match = findMatch(sc.projectName, existing);
    if (!match) { skipped++; continue; }
    matched++;

    // Case updates
    const patch = extractCasePatch(sc, match);
    if (Object.keys(patch).length > 0) {
      caseUpdates.push({ id: match.id, name: match.client_name, patch });
    }

    // Claim details - insert if new, update if exists (to fill new columns)
    const cd = extractClaimDetails(sc, match.id);
    if (cd) {
      if (claimCaseIds.has(match.id)) {
        const { case_id, ...updateData } = cd;
        claimUpdates.push({ caseId: match.id, name: match.client_name, data: updateData });
      } else {
        claimInserts.push({ name: match.client_name, data: cd });
        claimCaseIds.add(match.id); // prevent duplicate inserts
      }
    }

    // Litigation details - insert if new, update if exists
    const ld = extractLitigationDetails(sc, match.id);
    if (ld) {
      if (litCaseIds.has(match.id)) {
        const { case_id, ...updateData } = ld;
        litUpdates.push({ caseId: match.id, name: match.client_name, data: updateData });
      } else {
        litInserts.push({ name: match.client_name, data: ld });
        litCaseIds.add(match.id);
      }
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

  if (claimInserts.length || claimUpdates.length) {
    console.log(`📋 CLAIM DETAILS: ${claimInserts.length} new + ${claimUpdates.length} updates`);
    const all = [...claimInserts, ...claimUpdates];
    const avgFields = Math.round(all.reduce((a, c) => a + Object.keys(c.data).length, 0) / all.length);
    console.log(`   Average ${avgFields} fields per row\n`);
  }

  if (litInserts.length || litUpdates.length) {
    console.log(`⚖️  LITIGATION DETAILS: ${litInserts.length} new + ${litUpdates.length} updates`);
    const all = [...litInserts, ...litUpdates];
    const avgFields = Math.round(all.reduce((a, c) => a + Object.keys(c.data).length, 0) / all.length);
    console.log(`   Average ${avgFields} fields per row\n`);
  }

  const totalChanges = caseUpdates.length + claimInserts.length + claimUpdates.length + litInserts.length + litUpdates.length;
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
    if (error) { console.error(`  ❌ claim_details INSERT/${ci.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  for (const cu of claimUpdates) {
    const { error } = await supabase.from('claim_details').update(cu.data).eq('case_id', cu.caseId);
    if (error) { console.error(`  ❌ claim_details UPDATE/${cu.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  for (const li of litInserts) {
    const { error } = await supabase.from('litigation_details').insert(li.data);
    if (error) { console.error(`  ❌ litigation_details INSERT/${li.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  for (const lu of litUpdates) {
    const { error } = await supabase.from('litigation_details').update(lu.data).eq('case_id', lu.caseId);
    if (error) { console.error(`  ❌ litigation_details UPDATE/${lu.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  console.log(`\n✅ ${ok} succeeded, ❌ ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
