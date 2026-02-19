const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');

if (!DRY_RUN && !APPLY) {
  console.log('Usage: node scripts/enrich-pass2.js --dry-run | --apply');
  process.exit(1);
}

console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLYING CHANGES ===');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const getEnv = (key) => {
  const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim() : null;
};

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

const extracted = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'filevine-extracted.json'), 'utf8'));
const fullData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'filevine-full-data.json'), 'utf8'));
const loisData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'lois-extracted-details.json'), 'utf8'));

// Merge lois cases into a lookup by name
const allSourceCases = [];

// From filevine-extracted.json
for (const c of extracted.cases) {
  if (c.status === 'test') continue;
  if (c.details || c.name) allSourceCases.push({ source: 'extracted', ...c });
}

// From lois-extracted-details.json
for (const c of loisData.cases) {
  allSourceCases.push({ source: 'lois', ...c });
}

// From filevine-full-data.json — extract caseSummary fields
for (const p of fullData) {
  const cs = p.sections?.caseSummary?.fields;
  if (!cs) continue;
  allSourceCases.push({
    source: 'fulldata',
    projectId: p.projectId,
    projectName: p.projectName,
    court: cs.Court,
    courtCaseNumber: cs.courtcasenumber,
    opposingCounsel: cs['Opposing Counsel'],
    caseDescription: cs.casedescription,
    courtCaption: cs.courtcaptionieinthecircuitcourtoft,
    plaintiffCaption: cs.plaintiffcaption,
    defendantCaption: cs.defendantcaption,
    contractSigned: cs['Date Contract Signed'],
    completedDate: cs.Done,
    primaryAttorney: cs['Primary Attorney'],
    supportStaff: cs.Support,
    certificateOfService: cs.certificateofservice,
    clientPhone: p.clientPhone,
    clientEmail: p.clientEmail,
  });
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchCase(dbCase, sourceCases) {
  const dbName = normalize(dbCase.client_name);
  const matches = [];
  for (const sc of sourceCases) {
    const srcName = normalize(sc.name || sc.projectName || '');
    if (!srcName || srcName.length < 3) continue;
    // Check if either contains the other, or significant overlap
    if (dbName.includes(srcName) || srcName.includes(dbName)) {
      matches.push(sc);
      continue;
    }
    // Try matching on last name (first word before comma or 'v.')
    const dbFirst = dbName.split(/v[^a-z]|,/)[0].trim();
    const srcFirst = srcName.split(/v[^a-z]|,/)[0].trim();
    if (dbFirst.length >= 4 && srcFirst.length >= 4 && (dbFirst.includes(srcFirst) || srcFirst.includes(dbFirst))) {
      matches.push(sc);
    }
  }
  return matches;
}

async function main() {
  // Fetch all cases
  const { data: cases, error } = await supabase.from('cases').select('id, client_name, statute_of_limitations, adjuster_name, adjuster_phone, adjuster_email, claim_number, policy_number, property_address');
  if (error) { console.error('Failed to fetch cases:', error); return; }

  // Fetch existing litigation_details 
  const { data: litRows } = await supabase.from('litigation_details').select('id, case_id, case_number, court, judge, filed_date, trial_date, opposing_counsel, contract_signed, court_caption, plaintiff_caption, defendant_caption, case_description, primary_attorney, support_staff, certificate_of_service, sol_date');
  const litByCase = {};
  for (const r of (litRows || [])) litByCase[r.case_id] = r;

  // Fetch existing claim_details
  const { data: claimRows } = await supabase.from('claim_details').select('id, case_id, adjuster_name, adjuster_email, claim_number, policy_number, property_address, date_of_loss, cause_of_loss, type_of_loss, deductible, estimate_total, date_of_intake, date_contract_signed');
  const claimByCase = {};
  for (const r of (claimRows || [])) claimByCase[r.case_id] = r;

  // Fetch existing negotiations
  const { data: negRows } = await supabase.from('negotiations').select('id, case_id, type, amount');
  const negByCase = {};
  for (const r of (negRows || [])) { if (!negByCase[r.case_id]) negByCase[r.case_id] = []; negByCase[r.case_id].push(r); }

  const stats = { casesUpdated: 0, litUpdated: 0, claimUpdated: 0, negInserted: 0, estInserted: 0, unmatched: [], matched: 0 };

  for (const dbCase of cases) {
    const matches = matchCase(dbCase, allSourceCases);
    if (matches.length === 0) continue;
    stats.matched++;

    // Merge all matched source data
    const merged = {};
    for (const m of matches) {
      Object.assign(merged, m.details || {});
      // Copy top-level fields from lois/extracted
      for (const k of ['adjuster', 'adjusterEmail', 'claimNumber', 'policyNumber', 'property', 'propertyAddress', 'sol', 'solDate',
        'court', 'caseNumber', 'courtCaseNumber', 'demandAmount', 'settlementOffer', 'clientBottomLine', 'estimateAmount',
        'dateOfLoss', 'lossType', 'typeOfLoss', 'causeOfLoss', 'filingDate', 'trialDate', 'trialDates', 'judge',
        'opposingCounsel', 'caseDescription', 'courtCaption', 'plaintiffCaption', 'defendantCaption',
        'contractSigned', 'completedDate', 'primaryAttorney', 'supportStaff', 'certificateOfService',
        'deductible', 'dateOfIntake', 'badFaithDemand', 'notes']) {
        if (m[k] !== undefined && m[k] !== null) merged[k] = m[k];
      }
    }

    // === UPDATE cases table ===
    const caseUpdates = {};
    if (!dbCase.adjuster_name && (merged.adjuster || merged.adjusterName)) caseUpdates.adjuster_name = merged.adjuster || merged.adjusterName;
    if (!dbCase.adjuster_email && merged.adjusterEmail) caseUpdates.adjuster_email = merged.adjusterEmail;
    if (!dbCase.claim_number && merged.claimNumber) caseUpdates.claim_number = merged.claimNumber;
    if (!dbCase.policy_number && merged.policyNumber) caseUpdates.policy_number = merged.policyNumber;
    if (!dbCase.property_address && (merged.property || merged.propertyAddress)) caseUpdates.property_address = merged.property || merged.propertyAddress;
    
    const solVal = merged.sol || merged.solDate || merged.sol_property;
    if (!dbCase.statute_of_limitations && solVal) caseUpdates.statute_of_limitations = solVal;

    if (Object.keys(caseUpdates).length > 0) {
      console.log(`[CASE] ${dbCase.client_name}: ${JSON.stringify(caseUpdates)}`);
      if (APPLY) {
        const { error } = await supabase.from('cases').update(caseUpdates).eq('id', dbCase.id);
        if (error) console.error(`  ERROR updating case:`, error.message);
      }
      stats.casesUpdated++;
    }

    // === UPDATE claim_details ===
    const cd = claimByCase[dbCase.id];
    if (cd) {
      const claimUpdates = {};
      if (!cd.adjuster_name && (merged.adjuster || merged.adjusterName)) claimUpdates.adjuster_name = merged.adjuster || merged.adjusterName;
      if (!cd.adjuster_email && merged.adjusterEmail) claimUpdates.adjuster_email = merged.adjusterEmail;
      if (!cd.date_of_loss && merged.dateOfLoss) claimUpdates.date_of_loss = merged.dateOfLoss;
      if (!cd.cause_of_loss && (merged.causeOfLoss || merged.lossType || merged.typeOfLoss)) claimUpdates.cause_of_loss = merged.causeOfLoss || merged.lossType || merged.typeOfLoss;
      if (!cd.type_of_loss && (merged.typeOfLoss || merged.lossType)) claimUpdates.type_of_loss = merged.typeOfLoss || merged.lossType;
      if (!cd.deductible && merged.deductible) claimUpdates.deductible = merged.deductible;
      if (!cd.estimate_total && merged.estimateAmount) claimUpdates.estimate_total = merged.estimateAmount;
      if (!cd.date_of_intake && merged.dateOfIntake) claimUpdates.date_of_intake = merged.dateOfIntake;
      if (!cd.date_contract_signed && merged.contractSigned) claimUpdates.date_contract_signed = merged.contractSigned;

      if (Object.keys(claimUpdates).length > 0) {
        console.log(`[CLAIM] ${dbCase.client_name}: ${JSON.stringify(claimUpdates)}`);
        if (APPLY) {
          const { error } = await supabase.from('claim_details').update(claimUpdates).eq('id', cd.id);
          if (error) console.error(`  ERROR updating claim_details:`, error.message);
        }
        stats.claimUpdated++;
      }
    }

    // === UPDATE litigation_details ===
    const lit = litByCase[dbCase.id];
    if (lit) {
      const litUpdates = {};
      if (!lit.case_number && (merged.caseNumber || merged.courtCaseNumber)) litUpdates.case_number = merged.caseNumber || merged.courtCaseNumber;
      if (!lit.court && merged.court) litUpdates.court = merged.court;
      if (!lit.judge && merged.judge) litUpdates.judge = merged.judge;
      if (!lit.filed_date && merged.filingDate) litUpdates.filed_date = merged.filingDate;
      if (!lit.opposing_counsel && merged.opposingCounsel) litUpdates.opposing_counsel = merged.opposingCounsel;
      if (!lit.court_caption && merged.courtCaption) litUpdates.court_caption = merged.courtCaption;
      if (!lit.plaintiff_caption && merged.plaintiffCaption) litUpdates.plaintiff_caption = merged.plaintiffCaption;
      if (!lit.defendant_caption && merged.defendantCaption) litUpdates.defendant_caption = merged.defendantCaption;
      if (!lit.case_description && merged.caseDescription) litUpdates.case_description = merged.caseDescription;
      if (!lit.contract_signed && merged.contractSigned) litUpdates.contract_signed = merged.contractSigned;
      if (!lit.primary_attorney && merged.primaryAttorney) litUpdates.primary_attorney = merged.primaryAttorney;
      if (!lit.support_staff && merged.supportStaff) litUpdates.support_staff = merged.supportStaff;
      if (!lit.certificate_of_service && merged.certificateOfService) litUpdates.certificate_of_service = merged.certificateOfService;
      if (!lit.sol_date && (merged.sol || merged.solDate)) litUpdates.sol_date = merged.sol || merged.solDate;
      
      // Trial date - parse from trialDates if needed
      if (!lit.trial_date) {
        let td = merged.trialDate;
        if (!td && merged.trialDates) {
          // "2026-04-14 to 2026-04-17" -> take first date
          td = merged.trialDates.split(/\s+to\s+/)[0];
        }
        if (td) litUpdates.trial_date = td;
      }

      if (Object.keys(litUpdates).length > 0) {
        console.log(`[LIT] ${dbCase.client_name}: ${JSON.stringify(litUpdates)}`);
        if (APPLY) {
          const { error } = await supabase.from('litigation_details').update(litUpdates).eq('id', lit.id);
          if (error) console.error(`  ERROR updating litigation_details:`, error.message);
        }
        stats.litUpdated++;
      }
    }

    // === INSERT negotiations ===
    const existingNegs = negByCase[dbCase.id] || [];
    const negsToInsert = [];

    if (merged.demandAmount) {
      const already = existingNegs.some(n => n.type === 'presuit_demand' && parseFloat(n.amount) === parseFloat(merged.demandAmount));
      if (!already) {
        negsToInsert.push({ case_id: dbCase.id, type: 'presuit_demand', amount: merged.demandAmount, date: new Date().toISOString().split('T')[0], notes: 'Imported from Filevine data' });
      }
    }
    if (merged.settlementOffer) {
      const already = existingNegs.some(n => n.type === 'defendant_offer' && parseFloat(n.amount) === parseFloat(merged.settlementOffer));
      if (!already) {
        negsToInsert.push({ case_id: dbCase.id, type: 'defendant_offer', amount: merged.settlementOffer, date: new Date().toISOString().split('T')[0], notes: 'Imported from Filevine data' });
      }
    }
    if (merged.clientBottomLine) {
      const already = existingNegs.some(n => n.type === 'bottom_line' && parseFloat(n.amount) === parseFloat(merged.clientBottomLine));
      if (!already) {
        negsToInsert.push({ case_id: dbCase.id, type: 'bottom_line', amount: merged.clientBottomLine, date: new Date().toISOString().split('T')[0], notes: 'Imported from Filevine data' });
      }
    }
    if (merged.badFaithDemand) {
      const already = existingNegs.some(n => n.type === 'plaintiff_offer' && parseFloat(n.amount) === parseFloat(merged.badFaithDemand));
      if (!already) {
        negsToInsert.push({ case_id: dbCase.id, type: 'plaintiff_offer', amount: merged.badFaithDemand, date: new Date().toISOString().split('T')[0], notes: 'Bad faith demand - imported from Filevine' });
      }
    }

    for (const neg of negsToInsert) {
      console.log(`[NEG] ${dbCase.client_name}: ${neg.type} = $${neg.amount}`);
      if (APPLY) {
        const { error } = await supabase.from('negotiations').insert(neg);
        if (error) console.error(`  ERROR inserting negotiation:`, error.message);
      }
      stats.negInserted++;
    }

    // === INSERT estimates ===
    if (merged.estimateAmount) {
      console.log(`[EST] ${dbCase.client_name}: estimate = $${merged.estimateAmount}`);
      if (APPLY) {
        const { error } = await supabase.from('estimates').insert({
          case_id: dbCase.id,
          type: 'contractor',
          amount: merged.estimateAmount,
          date: new Date().toISOString().split('T')[0],
          notes: 'Imported from Filevine data'
        });
        if (error) console.error(`  ERROR inserting estimate:`, error.message);
      }
      stats.estInserted++;
    }
  }

  // Find unmatched source cases
  for (const sc of allSourceCases) {
    if (sc.source === 'fulldata' && !sc.court && !sc.courtCaseNumber) continue; // skip uninteresting fulldata
    const srcName = sc.name || sc.projectName || '';
    if (!srcName || srcName.length < 3) continue;
    const found = cases.some(db => {
      const m = matchCase(db, [sc]);
      return m.length > 0;
    });
    if (!found) stats.unmatched.push(srcName);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Cases matched: ${stats.matched}`);
  console.log(`Cases updated: ${stats.casesUpdated}`);
  console.log(`Claim details updated: ${stats.claimUpdated}`);
  console.log(`Litigation details updated: ${stats.litUpdated}`);
  console.log(`Negotiations inserted: ${stats.negInserted}`);
  console.log(`Estimates inserted: ${stats.estInserted}`);
  if (stats.unmatched.length > 0) {
    console.log(`\nUnmatched source cases (${stats.unmatched.length}):`);
    for (const u of stats.unmatched) console.log(`  - ${u}`);
  }
}

main().catch(console.error);
