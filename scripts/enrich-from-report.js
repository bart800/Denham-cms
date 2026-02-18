/**
 * Enrich Supabase from Filevine Report Builder XLSX export.
 * This has cleaner structured data than the DOM scraper.
 * 
 * Usage: node scripts/enrich-from-report.js [--commit]
 */
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMMIT = process.argv.includes('--commit');
const XLSX_PATH = path.resolve(__dirname, '../data/filevine-report-full.xlsx');

function normSpaces(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function findMatch(name, dbCases) {
  if (!name) return null;
  const pn = normSpaces(name);
  const pnStripped = pn.replace(/ /g, '');
  let found = dbCases.find(c => normSpaces(c.client_name).replace(/ /g, '') === pnStripped);
  if (found) return found;
  found = dbCases.find(c => {
    const cn = normSpaces(c.client_name);
    return cn.length > 3 && pn.includes(cn);
  });
  if (found) return found;
  const pw = pn.split(/\s+/)[0];
  if (pw.length > 3) {
    const matches = dbCases.filter(c => normSpaces(c.client_name).split(/\s+/)[0] === pw);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

// Excel serial date to YYYY-MM-DD
function excelDate(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    // Already a date string?
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const m2 = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return v.substring(0, 10);
    return null;
  }
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date((v - 25569) * 86400000);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }
  return null;
}

function toBool(v) {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return null;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function toStr(v) {
  if (v == null || v === '' || v === 0) return null;
  return String(v).trim() || null;
}

function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

async function main() {
  console.log(COMMIT ? '🔥 COMMIT MODE' : '🔍 DRY RUN — pass --commit to write\n');

  const wb = XLSX.readFile(XLSX_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`📂 Loaded ${rows.length} rows from XLSX report`);

  const { data: cases, error } = await supabase.from('cases').select('*');
  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`📊 ${cases.length} cases in Supabase\n`);

  const { data: existingClaims } = await supabase.from('claim_details').select('case_id');
  const claimCaseIds = new Set((existingClaims || []).map(r => r.case_id));

  let matched = 0, skipped = 0;
  const claimOps = []; // { op: 'insert'|'update', caseId, name, data }
  const caseUpdates = [];

  // Map attorney names to team_member UUIDs
  const { data: team } = await supabase.from('team_members').select('id, name');
  const teamMap = new Map();
  (team || []).forEach(t => teamMap.set(t.name.toLowerCase(), t.id));

  for (const row of rows) {
    const match = findMatch(row.Name, cases);
    if (!match) { skipped++; continue; }
    matched++;

    // Build claim_details data from XLSX columns
    const cd = {};
    cd.type_of_loss = toStr(row['Type of Loss']);
    cd.cause_of_loss = toStr(row['Cause of Loss']);
    cd.claim_status = toStr(row['Claim Status']);
    cd.claim_number = toStr(row['Claim Number']);
    cd.policy_number = toStr(row['Policy Number']);
    cd.deductible = toStr(row['Deductible']);
    cd.property_address = toStr(row['Insured Property - Street, City Zip']);
    cd.insured_property_state = toStr(row['Insured Property State']);
    cd.insured_property_zip = toStr(row['Insured Property Zip Code']);
    cd.insured_county = toStr(row['Insured County']);
    cd.date_of_loss = excelDate(row['Date of Loss']);
    cd.date_of_intake = excelDate(row['Date of Intake']);
    cd.date_contract_signed = excelDate(row['Date Contract Signed']);
    cd.estimate_date = excelDate(row['Date of Estimate']);
    cd.policy_period_start = excelDate(row['Policy Period Start']);
    cd.policy_period_end = excelDate(row['Policy Period End']);
    cd.coverage_dwelling = toNum(row['Dwelling']);
    cd.coverage_other_structure = toNum(row['Other Structure']);
    cd.coverage_contents = toNum(row['Contents']);
    cd.coverage_ale = null; // Not in this report
    cd.coverage_loss_of_income = toNum(row['Loss of Income']);
    cd.estimate_total = toNum(row['Estimate for Total Damages']);
    cd.estimate_interior = toNum(row['Estimate for Interior Damages']);
    cd.areas_of_damage = toStr(row['Areas of Damage (Please list all areas of damage from this loss event)']);
    cd.how_noticed_damage = toStr(row['How did you notice the damage?']);
    cd.where_damage = toStr(row['Where?']);
    cd.marketing_source = toStr(row['Marketing Source']);
    cd.preferred_contact_method = toStr(row['Preferred Method of Contact']);
    cd.other_explanation = toStr(row['Other Explanation']);
    cd.additional_endorsement_amounts = toStr(row['Additional Endorsement Amounts']);
    cd.amount_of_payments = toStr(row['Amount of Payment(s)']);
    cd.phase = toStr(row['Phase']);
    
    // Booleans
    cd.has_interior_damage = toBool(row['Any interior damage?']);
    cd.has_prior_payments = toBool(row['Any prior payments received?']);
    cd.has_mortgage = toBool(row['Is there a mortgage on the property?']);
    cd.other_insured_on_policy = toBool(row['Is anyone else listed on the policy?']);
    cd.has_pa_contractor_estimates = toBool(row['Have you received estimates from Public Adjuster or Contractor?']);
    cd.has_made_repairs = toBool(row['Have you made any repairs?']);
    cd.has_prior_claim = toBool(row['Have you ever filed a claim before?']);
    cd.third_party_insurance = toBool(row['Third Party Insurance?']);
    cd.estimates_still_needed = toBool(row['Are any estimates still needed?']);
    cd.check_cashed = toBool(row['Was the check cashed?']);
    
    // Prior claim details
    cd.prior_claim_date = toStr(row['When did you file a prior claim?']);
    cd.prior_claim_with = toStr(row['Who did you file a prior claim with?']);
    cd.prior_claim_reason = toStr(row['Why did you file a prior claim?']);
    
    // Third party
    cd.third_party_policy_number = toStr(row['Third Party Policy Number']);
    cd.third_party_claim_number = toStr(row['Third Party Claim Number']);
    cd.third_party_liability_status = toStr(row['Third Party Accepted Liability or Denied?']);
    
    // Counts
    cd.count_estimates_upload = toInt(row['Count of Estimates Upload']);
    cd.count_denial_letter = toInt(row['Count of Denial Letter']);
    cd.count_carrier_estimate = toInt(row['Count of Carrier Estimate']);
    
    // Filevine Person IDs
    cd.fv_adjuster_id = toStr(row['Adjuster Person Id']);
    cd.fv_defendant_id = toStr(row['Defendant Person Id']);
    cd.fv_mortgage_id = toStr(row['Mortgage Company Person Id']);
    cd.fv_other_insured_id = toStr(row['Other Insured Person Id']);
    cd.fv_registered_agent_id = toStr(row['Registered Agent (Defendant) Person Id']);
    cd.fv_referred_by_id = toStr(row['Referred By Person Id']);
    cd.fv_third_party_insurer_id = toStr(row['Third Party Insurance Company Person Id']);
    cd.fv_third_party_adjuster_id = toStr(row['Third Party Insurance Adjuster Person Id']);

    // Strip nulls
    for (const k of Object.keys(cd)) {
      if (cd[k] === null || cd[k] === undefined) delete cd[k];
    }

    if (Object.keys(cd).length > 0) {
      if (claimCaseIds.has(match.id)) {
        claimOps.push({ op: 'update', caseId: match.id, name: match.client_name, data: cd });
      } else {
        cd.case_id = match.id;
        claimOps.push({ op: 'insert', caseId: match.id, name: match.client_name, data: cd });
        claimCaseIds.add(match.id);
      }
    }

    // Also update cases table: attorney_id from "First Primary", status from Phase
    const casePatch = {};
    const attyName = row['First Primary'];
    if (attyName) {
      const attyId = teamMap.get(attyName.toLowerCase());
      if (attyId && match.attorney_id !== attyId) casePatch.attorney_id = attyId;
    }
    // Phase → status
    const phaseMap = {
      'Pre-Suit': 'Presuit Demand',
      'Litigation': 'Litigation - Filed',
      'Settlement': 'Settled',
      'Appraisal': 'Appraisal',
      'Referred': 'Referred',
    };
    const newStatus = phaseMap[row['Phase']];
    if (newStatus && match.status !== newStatus) casePatch.status = newStatus;
    
    if (Object.keys(casePatch).length > 0) {
      caseUpdates.push({ id: match.id, name: match.client_name, patch: casePatch });
    }
  }

  // Report
  console.log('═══════════════════════════════════════════════');
  console.log('  REPORT BUILDER ENRICHMENT');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`  Matched:    ${matched}/${rows.length}`);
  console.log(`  No match:   ${skipped}\n`);

  const inserts = claimOps.filter(o => o.op === 'insert');
  const updates = claimOps.filter(o => o.op === 'update');
  console.log(`📋 CLAIM DETAILS: ${inserts.length} new + ${updates.length} updates`);
  if (claimOps.length > 0) {
    const avgFields = Math.round(claimOps.reduce((a, c) => a + Object.keys(c.data).length, 0) / claimOps.length);
    console.log(`   Average ${avgFields} fields per row`);
  }

  if (caseUpdates.length) {
    const statusUpdates = caseUpdates.filter(u => u.patch.status).length;
    const attyUpdates = caseUpdates.filter(u => u.patch.attorney_id).length;
    console.log(`\n📝 CASE UPDATES: ${caseUpdates.length} total`);
    if (statusUpdates) console.log(`   Status updates: ${statusUpdates}`);
    if (attyUpdates) console.log(`   Attorney assignments: ${attyUpdates}`);
  }

  const totalOps = claimOps.length + caseUpdates.length;
  if (!COMMIT) {
    console.log(`\n💡 ${totalOps} total operations. Run with --commit to apply.`);
    return;
  }

  console.log('\n🔥 Committing...\n');
  let ok = 0, fail = 0;

  for (const op of claimOps) {
    if (op.op === 'insert') {
      const { error } = await supabase.from('claim_details').insert(op.data);
      if (error) { console.error(`  ❌ INSERT ${op.name}: ${error.message}`); fail++; }
      else { ok++; }
    } else {
      const { error } = await supabase.from('claim_details').update(op.data).eq('case_id', op.caseId);
      if (error) { console.error(`  ❌ UPDATE ${op.name}: ${error.message}`); fail++; }
      else { ok++; }
    }
  }

  for (const u of caseUpdates) {
    const { error } = await supabase.from('cases').update(u.patch).eq('id', u.id);
    if (error) { console.error(`  ❌ cases/${u.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  console.log(`\n✅ ${ok} succeeded, ❌ ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
