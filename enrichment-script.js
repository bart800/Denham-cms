const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://amyttoowrroajffqubpd.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA';
const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Load data
const scraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/filevine-scraped-v1.json'), 'utf8'));
const fullData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/filevine-full-data.json'), 'utf8'));

// Index full data by projectId
const fullDataMap = {};
for (const entry of fullData) {
  fullDataMap[entry.projectId] = entry;
}

// Clean phone/email
function cleanPhone(raw) {
  if (!raw) return null;
  return raw.replace(/^phone\s+slot-text:phone\s*/i, '').trim() || null;
}
function cleanEmail(raw) {
  if (!raw) return null;
  return raw.replace(/^email\s+slot-text:email\s*/i, '').trim() || null;
}

// Parse date MM/DD/YYYY -> YYYY-MM-DD
function parseDate(d) {
  if (!d) return null;
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
}

// Extract client name from projectName like "Kerby v. Erie" -> "Kerby"
function extractClientName(projectName) {
  if (!projectName) return null;
  const parts = projectName.split(/\s+v\.\s+/i);
  return parts[0].trim();
}

// Normalize for matching
function norm(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function supaGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: HEADERS });
  return r.json();
}

async function supaPatch(table, id, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify(data)
  });
  return r.json();
}

async function supaUpsert(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function main() {
  console.log(`Loading ${scraped.length} scraped entries, ${fullData.length} full data entries`);

  // Get ALL cases from Supabase
  const allCases = [];
  let offset = 0;
  while (true) {
    const batch = await supaGet('cases', `select=id,client_name,insurer,date_of_loss,client_phone,client_email,cause_of_loss,property_address&limit=500&offset=${offset}`);
    if (!batch.length) break;
    allCases.push(...batch);
    offset += batch.length;
    if (batch.length < 500) break;
  }
  console.log(`Loaded ${allCases.length} cases from Supabase`);

  // Get existing claim_details, litigation_details, negotiations
  const existingClaims = await supaGet('claim_details', 'select=case_id,policy_number,claim_number&limit=1000');
  const existingLit = await supaGet('litigation_details', 'select=case_id,case_number&limit=1000');
  const existingNeg = await supaGet('negotiations', 'select=case_id,type,amount&limit=2000');
  
  const claimByCaseId = {};
  for (const c of existingClaims) claimByCaseId[c.case_id] = c;
  const litByCaseId = {};
  for (const l of existingLit) litByCaseId[l.case_id] = l;
  const negByCaseId = {};
  for (const n of existingNeg) {
    if (!negByCaseId[n.case_id]) negByCaseId[n.case_id] = [];
    negByCaseId[n.case_id].push(n);
  }

  // Build case lookup by normalized client_name
  const casesByNorm = {};
  for (const c of allCases) {
    const n = norm(c.client_name);
    if (!casesByNorm[n]) casesByNorm[n] = [];
    casesByNorm[n].push(c);
  }

  let matched = 0, unmatched = 0;
  let casesUpdated = 0, claimsUpserted = 0, litUpserted = 0, negInserted = 0;
  const unmatchedNames = [];

  for (const entry of scraped) {
    const clientName = extractClientName(entry.projectName);
    const full = fullDataMap[entry.projectId];
    const caseSummary = full?.sections?.caseSummary?.fields || {};

    // Try to match: exact norm match on client name
    let matchedCase = null;
    const normClient = norm(clientName);
    
    // Try exact match
    if (casesByNorm[normClient]) {
      matchedCase = casesByNorm[normClient][0];
    } else {
      // Try substring match - if the Supabase client_name contains the Filevine client name
      for (const c of allCases) {
        if (norm(c.client_name).includes(normClient) && normClient.length >= 3) {
          matchedCase = c;
          break;
        }
      }
      // Also try if Filevine name contains Supabase name
      if (!matchedCase) {
        for (const c of allCases) {
          const cn = norm(c.client_name);
          if (cn.length >= 3 && normClient.includes(cn)) {
            matchedCase = c;
            break;
          }
        }
      }
      // Try last name match (first word of projectName)
      if (!matchedCase && clientName) {
        const lastName = norm(clientName.split(/[\s,]+/)[0]);
        if (lastName.length >= 3) {
          for (const c of allCases) {
            const cLastName = norm(c.client_name.split(/[\s,]+/)[0]);
            if (cLastName === lastName) {
              matchedCase = c;
              break;
            }
          }
        }
      }
    }

    if (!matchedCase) {
      unmatched++;
      unmatchedNames.push(entry.projectName);
      continue;
    }
    matched++;

    const caseId = matchedCase.id;
    const phone = cleanPhone(entry.clientPhone);
    const email = cleanEmail(entry.clientEmail);

    // 1. Update cases table (only fill blanks)
    const caseUpdates = {};
    if (!matchedCase.client_phone && phone) caseUpdates.client_phone = phone;
    if (!matchedCase.client_email && email) caseUpdates.client_email = email;
    if (!matchedCase.cause_of_loss && entry.causeofloss) caseUpdates.cause_of_loss = entry.causeofloss;
    if (!matchedCase.property_address && entry.insuredpropertyaddress) caseUpdates.property_address = entry.insuredpropertyaddress;
    if (!matchedCase.date_of_loss && entry['Date of Loss']) caseUpdates.date_of_loss = parseDate(entry['Date of Loss']);
    if (!matchedCase.insurer && entry['Insurance Company Name']) caseUpdates.insurer = entry['Insurance Company Name'];

    if (Object.keys(caseUpdates).length > 0) {
      await supaPatch('cases', caseId, caseUpdates);
      casesUpdated++;
      console.log(`[CASE] ${entry.projectName} -> ${matchedCase.client_name}: ${JSON.stringify(caseUpdates)}`);
    }

    // 2. Upsert claim_details
    const claimData = { case_id: caseId };
    let hasClaimUpdate = false;
    const existing = claimByCaseId[caseId];

    const claimFields = {
      policy_number: entry.policynumber,
      claim_number: entry.claimnumber,
      adjuster_name: entry.Adjuster,
      deductible: entry.deductible ? parseFloat(entry.deductible) || null : null,
      cause_of_loss: entry.causeofloss,
      date_of_loss: parseDate(entry['Date of Loss']),
      type_of_loss: entry['Type of Loss'],
      type_of_loss_detail: entry.typeofloss,
      areas_of_damage: entry.areasofdamagepleaselistallareasofd,
      how_noticed_damage: entry.howdidyounoticethedamage,
      insured_property_state: entry['Insured Property State'],
      insured_property_zip: entry.insuredpropertyzipcode,
      property_address: entry.insuredpropertyaddress,
      policy_period_start: parseDate(entry['Policy Period Start']),
      policy_period_end: parseDate(entry['Policy Period End']),
      coverage_dwelling: entry.Dwelling ? parseFloat(entry.Dwelling) : null,
      coverage_other_structure: entry['Other Structure'] ? parseFloat(entry['Other Structure']) : null,
      coverage_contents: entry.Contents ? parseFloat(entry.Contents) : null,
      estimate_total: entry['Estimate for Total Damages'] ? parseFloat(entry['Estimate for Total Damages']) : null,
      estimate_date: parseDate(entry['Date of Estimate']),
      date_of_intake: parseDate(entry['Date of Intake']),
      date_contract_signed: parseDate(caseSummary['Date Contract Signed']),
      additional_information: entry.additionalinformation,
    };

    // Build policy_limits string
    const limits = [];
    if (entry.Dwelling) limits.push(`Dwelling: $${parseFloat(entry.Dwelling).toLocaleString()}`);
    if (entry['Other Structure']) limits.push(`Other Structure: $${parseFloat(entry['Other Structure']).toLocaleString()}`);
    if (entry.Contents) limits.push(`Contents: $${parseFloat(entry.Contents).toLocaleString()}`);
    if (limits.length) claimFields.policy_limits = limits.join('; ');

    // Insurance company name
    if (entry['Insurance Company Name']) claimFields.insurance_company = entry['Insurance Company Name'];

    for (const [k, v] of Object.entries(claimFields)) {
      if (v !== null && v !== undefined && v !== '') {
        claimData[k] = v;
        hasClaimUpdate = true;
      }
    }

    if (hasClaimUpdate) {
      // If existing record, PATCH it (only fill blanks by fetching full record first)
      if (existing) {
        // Fetch full existing record
        const fullExisting = await supaGet('claim_details', `case_id=eq.${caseId}&limit=1`);
        if (fullExisting.length) {
          const patchData = {};
          for (const [k, v] of Object.entries(claimData)) {
            if (k === 'case_id') continue;
            if (fullExisting[0][k] === null || fullExisting[0][k] === undefined || fullExisting[0][k] === '') {
              patchData[k] = v;
            }
          }
          if (Object.keys(patchData).length > 0) {
            await supaPatch('claim_details', fullExisting[0].id, patchData);
            claimsUpserted++;
            console.log(`[CLAIM UPDATE] ${entry.projectName}: ${Object.keys(patchData).join(', ')}`);
          }
        }
      } else {
        // Insert new
        const r = await fetch(`${SUPABASE_URL}/rest/v1/claim_details`, {
          method: 'POST', headers: HEADERS, body: JSON.stringify(claimData)
        });
        const res = await r.json();
        if (r.ok) {
          claimsUpserted++;
          console.log(`[CLAIM INSERT] ${entry.projectName}: new claim_details record`);
        } else {
          console.log(`[CLAIM ERROR] ${entry.projectName}: ${JSON.stringify(res)}`);
        }
      }
    }

    // 3. Upsert litigation_details
    const courtCaseNum = caseSummary.courtcasenumber;
    const court = caseSummary.Court;
    const opposingCounsel = caseSummary['Opposing Counsel'];
    const plaintiffCaption = caseSummary.plaintiffcaption;
    const defendantCaption = caseSummary.defendantcaption;
    const courtCaption = caseSummary.courtcaptionieinthecircuitcourtoft;
    const primaryAttorney = caseSummary['Primary Attorney'];
    const supportStaff = caseSummary.Support;
    const contractSigned = parseDate(caseSummary['Date Contract Signed']);
    const completedDate = parseDate(caseSummary.Done);

    if (courtCaseNum || court || opposingCounsel) {
      const litData = { case_id: caseId };
      if (courtCaseNum) litData.case_number = courtCaseNum;
      if (court) litData.court = court;
      if (opposingCounsel) litData.opposing_counsel = opposingCounsel;
      if (plaintiffCaption) litData.plaintiff_caption = plaintiffCaption;
      if (defendantCaption) litData.defendant_caption = defendantCaption;
      if (courtCaption) litData.court_caption = courtCaption;
      if (primaryAttorney) litData.primary_attorney = primaryAttorney;
      if (supportStaff) litData.support_staff = supportStaff;
      if (contractSigned) litData.contract_signed = contractSigned;
      if (completedDate) litData.completed_date = completedDate;

      const existingLitRec = litByCaseId[caseId];
      if (existingLitRec) {
        // Fetch full and patch blanks only
        const fullLit = await supaGet('litigation_details', `case_id=eq.${caseId}&limit=1`);
        if (fullLit.length) {
          const patchData = {};
          for (const [k, v] of Object.entries(litData)) {
            if (k === 'case_id') continue;
            if (fullLit[0][k] === null || fullLit[0][k] === undefined || fullLit[0][k] === '') {
              patchData[k] = v;
            }
          }
          if (Object.keys(patchData).length > 0) {
            await supaPatch('litigation_details', fullLit[0].id, patchData);
            litUpserted++;
            console.log(`[LIT UPDATE] ${entry.projectName}: ${Object.keys(patchData).join(', ')}`);
          }
        }
      } else {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/litigation_details`, {
          method: 'POST', headers: HEADERS, body: JSON.stringify(litData)
        });
        const res = await r.json();
        if (r.ok) {
          litUpserted++;
          console.log(`[LIT INSERT] ${entry.projectName}: new litigation record`);
        } else {
          console.log(`[LIT ERROR] ${entry.projectName}: ${JSON.stringify(res)}`);
        }
      }
    }

    // 4. Negotiations - insert estimate as presuit_demand if not already present
    const estimateTotal = entry['Estimate for Total Damages'] ? parseFloat(entry['Estimate for Total Damages']) : null;
    if (estimateTotal && estimateTotal > 0) {
      const existingNegs = negByCaseId[caseId] || [];
      const alreadyHas = existingNegs.some(n => n.type === 'presuit_demand' && Math.abs(n.amount - estimateTotal) < 1);
      if (!alreadyHas) {
        const negData = {
          case_id: caseId,
          type: 'presuit_demand',
          amount: estimateTotal,
          date: parseDate(entry['Date of Estimate']) || new Date().toISOString().split('T')[0],
          notes: 'Imported from Filevine data'
        };
        const r = await fetch(`${SUPABASE_URL}/rest/v1/negotiations`, {
          method: 'POST', headers: HEADERS, body: JSON.stringify(negData)
        });
        if (r.ok) {
          negInserted++;
          console.log(`[NEG INSERT] ${entry.projectName}: $${estimateTotal}`);
        }
      }
    }
  }

  console.log('\n=== ENRICHMENT COMPLETE ===');
  console.log(`Matched: ${matched}/${scraped.length}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Cases updated: ${casesUpdated}`);
  console.log(`Claim details upserted: ${claimsUpserted}`);
  console.log(`Litigation records upserted: ${litUpserted}`);
  console.log(`Negotiations inserted: ${negInserted}`);
  if (unmatchedNames.length) {
    console.log('\nUnmatched projects:');
    for (const n of unmatchedNames) console.log(`  - ${n}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
