/**
 * Enrich Supabase cases from Filevine V2 full scraper output.
 * Reads data/filevine-full-data.json, matches to existing cases by client_name,
 * and updates cases + populates claim_details, litigation_details, negotiations, estimates.
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

function parseDate(s) {
  if (!s) return null;
  // MM/DD/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  // YYYY-MM-DD already
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

function field(sections, sectionName, fieldName) {
  const sec = sections?.[sectionName];
  if (!sec) return null;
  // Check fields object
  if (sec.fields?.[fieldName] !== undefined && sec.fields[fieldName] !== null && sec.fields[fieldName] !== '') {
    return String(sec.fields[fieldName]).trim();
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
  'Kentucky':'KY','Tennessee':'TN','Texas':'TX','Montana':'MT','Arizona':'AZ',
  'Indiana':'IN','Nebraska':'NE','Ohio':'OH','South Carolina':'SC','Colorado':'CO',
  'North Carolina':'NC','Michigan':'MI','Wyoming':'WY','Washington':'WA','Missouri':'MO',
  'California':'CA','New York':'NY','Florida':'FL','Georgia':'GA','Virginia':'VA',
  'Alabama':'AL','Mississippi':'MS','Louisiana':'LA','Illinois':'IL','Pennsylvania':'PA',
};

function mapState(s) {
  if (!s) return null;
  s = s.trim();
  return STATE_MAP[s] || (s.length === 2 ? s.toUpperCase() : null);
}

const NEGOTIATION_TYPE_MAP = {
  'bottom line': 'bottom_line',
  'bottomline': 'bottom_line',
  'plaintiff offer': 'plaintiff_offer',
  'plaintiff\'s offer': 'plaintiff_offer',
  'demand': 'presuit_demand',
  'presuit demand': 'presuit_demand',
  'defendant offer': 'defendant_offer',
  'defendant\'s offer': 'defendant_offer',
  'insurance offer': 'defendant_offer',
  'insurer offer': 'defendant_offer',
  'settlement': 'settlement',
  'undisputed payment': 'undisputed_payment',
  'undisputed': 'undisputed_payment',
  'denial': 'denial',
  'appraisal award': 'appraisal_award',
  'appraisal': 'appraisal_award',
};

function mapNegotiationType(s) {
  if (!s) return null;
  const key = s.toLowerCase().trim();
  return NEGOTIATION_TYPE_MAP[key] || key;
}

function parseAmount(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── Field Extraction ─────────────────────────────────────────

function extractCasePatch(sc, existing) {
  const s = sc.sections || {};
  const patch = {};

  // Client contact
  const phone = cleanPhone(sc.clientPhone) || cleanPhone(field(s, 'intake', 'Phone'))
    || cleanPhone(field(s, 'intake', 'Client Phone'));
  if (phone && !existing.client_phone) patch.client_phone = phone;

  const email = cleanEmail(sc.clientEmail) || cleanEmail(field(s, 'intake', 'Email'))
    || cleanEmail(field(s, 'intake', 'Client Email'));
  if (email && !existing.client_email) patch.client_email = email;

  // Insurer
  const insurer = firstNonEmpty(
    field(s, 'insurance', 'Insurance Company Name'),
    field(s, 'insurance', 'Insurance Company'),
    field(s, 'insurance', 'Insurer'),
    field(s, 'caseSummary', 'Insurance Company'),
    field(s, 'intake', 'Insurance Company'),
  );
  if (insurer && (!existing.insurer || existing.insurer === 'TBD')) patch.insurer = insurer;

  // Claim/policy numbers
  const claimNum = firstNonEmpty(
    field(s, 'insurance', 'Claim Number'), field(s, 'insurance', 'claimnumber'),
    field(s, 'caseSummary', 'Claim Number'), field(s, 'intake', 'Claim Number'),
  );
  if (claimNum && !existing.claim_number) patch.claim_number = claimNum;

  const policyNum = firstNonEmpty(
    field(s, 'insurance', 'Policy Number'), field(s, 'insurance', 'policynumber'),
    field(s, 'caseSummary', 'Policy Number'), field(s, 'intake', 'Policy Number'),
  );
  if (policyNum && !existing.policy_number) patch.policy_number = policyNum;

  // Date of loss
  const dol = parseDate(firstNonEmpty(
    field(s, 'caseSummary', 'Date of Loss'), field(s, 'intake', 'Date of Loss'),
    field(s, 'insurance', 'Date of Loss'),
  ));
  if (dol && !existing.date_of_loss) patch.date_of_loss = dol;

  // Date opened
  const doi = parseDate(firstNonEmpty(
    field(s, 'intake', 'Date of Intake'), field(s, 'intake', 'Date Opened'),
    field(s, 'caseSummary', 'Date Opened'),
  ));
  if (doi && !existing.date_opened) patch.date_opened = doi;

  // Statute of limitations
  const sol = parseDate(firstNonEmpty(
    field(s, 'caseSummary', 'Statute of Limitations'),
    field(s, 'intake', 'Statute of Limitations'),
  ));
  if (sol && !existing.statute_of_limitations) patch.statute_of_limitations = sol;

  // Jurisdiction / state
  const state = mapState(firstNonEmpty(
    field(s, 'insurance', 'Insured Property State'), field(s, 'intake', 'State'),
    field(s, 'caseSummary', 'State'), field(s, 'insurance', 'State'),
  ));
  if (state && (!existing.jurisdiction || existing.jurisdiction === 'KY')) patch.jurisdiction = state;

  // Type / cause of loss
  const lossType = firstNonEmpty(
    field(s, 'caseSummary', 'Type of Loss'), field(s, 'intake', 'Type of Loss'),
    field(s, 'caseSummary', 'Cause of Loss'), field(s, 'insurance', 'Cause of Loss'),
  );
  if (lossType) {
    if (!existing.cause_of_loss) patch.cause_of_loss = lossType;
    const typeMap = { fire: 'Fire', water: 'Water', wind: 'Wind', hail: 'Hail', storm: 'Wind', hurricane: 'Wind', tornado: 'Wind', flood: 'Water' };
    const mapped = typeMap[lossType.toLowerCase()];
    if (mapped && (!existing.type || existing.type === 'Property')) patch.type = mapped;
  }

  // Property address
  const propAddr = firstNonEmpty(
    field(s, 'insurance', 'Property Address'), field(s, 'insurance', 'Insured Property Address'),
    field(s, 'caseSummary', 'Property Address'), field(s, 'intake', 'Property Address'),
    // Try to compose from parts
    [field(s, 'insurance', 'Street'), field(s, 'insurance', 'City'), field(s, 'insurance', 'State'), field(s, 'insurance', 'Zip')]
      .filter(Boolean).join(', ') || null,
  );
  if (propAddr && !existing.property_address) patch.property_address = propAddr;

  // Adjuster info
  const adjName = firstNonEmpty(
    field(s, 'insurance', 'Adjuster Name'), field(s, 'insurance', 'Adjuster'),
    field(s, 'caseSummary', 'Adjuster Name'),
  );
  if (adjName && !existing.adjuster_name) patch.adjuster_name = adjName;

  const adjPhone = cleanPhone(firstNonEmpty(
    field(s, 'insurance', 'Adjuster Phone'), field(s, 'insurance', 'Adjuster Phone Number'),
  ));
  if (adjPhone && !existing.adjuster_phone) patch.adjuster_phone = adjPhone;

  const adjEmail = cleanEmail(firstNonEmpty(
    field(s, 'insurance', 'Adjuster Email'), field(s, 'insurance', 'Adjuster Email Address'),
  ));
  if (adjEmail && !existing.adjuster_email) patch.adjuster_email = adjEmail;

  // Recovery / fees
  const recovery = parseAmount(firstNonEmpty(
    field(s, 'caseSummary', 'Total Recovery'), field(s, 'negotiations', 'Total Recovery'),
  ));
  if (recovery && (!existing.total_recovery || existing.total_recovery === 0)) patch.total_recovery = recovery;

  const fees = parseAmount(firstNonEmpty(
    field(s, 'caseSummary', 'Attorney Fees'), field(s, 'negotiations', 'Attorney Fees'),
  ));
  if (fees && (!existing.attorney_fees || existing.attorney_fees === 0)) patch.attorney_fees = fees;

  return patch;
}

function extractClaimDetails(sc, caseId) {
  const s = sc.sections || {};
  const cd = {};

  cd.case_id = caseId;
  cd.policy_number = firstNonEmpty(field(s, 'insurance', 'Policy Number'), field(s, 'insurance', 'policynumber'));
  cd.claim_number = firstNonEmpty(field(s, 'insurance', 'Claim Number'), field(s, 'insurance', 'claimnumber'));
  cd.insurer = firstNonEmpty(field(s, 'insurance', 'Insurance Company Name'), field(s, 'insurance', 'Insurance Company'));
  cd.adjuster_name = firstNonEmpty(field(s, 'insurance', 'Adjuster Name'), field(s, 'insurance', 'Adjuster'));
  cd.adjuster_phone = cleanPhone(field(s, 'insurance', 'Adjuster Phone'));
  cd.adjuster_email = cleanEmail(field(s, 'insurance', 'Adjuster Email'));
  cd.date_of_loss = parseDate(firstNonEmpty(field(s, 'caseSummary', 'Date of Loss'), field(s, 'insurance', 'Date of Loss')));
  cd.date_reported = parseDate(firstNonEmpty(field(s, 'insurance', 'Date Reported'), field(s, 'insurance', 'Date Claim Reported')));
  cd.date_denied = parseDate(firstNonEmpty(field(s, 'insurance', 'Date Denied'), field(s, 'insurance', 'Denial Date')));
  cd.policy_type = firstNonEmpty(field(s, 'insurance', 'Policy Type'), field(s, 'insurance', 'Type of Policy'));
  cd.policy_limits = firstNonEmpty(field(s, 'insurance', 'Policy Limits'), field(s, 'insurance', 'Coverage Limits'));
  cd.deductible = firstNonEmpty(field(s, 'insurance', 'Deductible'));
  cd.cause_of_loss = firstNonEmpty(field(s, 'caseSummary', 'Cause of Loss'), field(s, 'insurance', 'Cause of Loss'), field(s, 'caseSummary', 'Type of Loss'));
  cd.property_address = firstNonEmpty(
    field(s, 'insurance', 'Property Address'), field(s, 'insurance', 'Insured Property Address'),
    field(s, 'caseSummary', 'Property Address'),
  );

  // Only return if we have at least one non-null field beyond case_id
  const hasData = Object.entries(cd).some(([k, v]) => k !== 'case_id' && v != null);
  return hasData ? cd : null;
}

function extractLitigationDetails(sc, caseId) {
  const s = sc.sections || {};
  const ld = { case_id: caseId };

  ld.case_number = firstNonEmpty(field(s, 'caseSummary', 'Case Number'), field(s, 'caseSummary', 'Court Case Number'));
  ld.court = firstNonEmpty(field(s, 'caseSummary', 'Court'), field(s, 'caseSummary', 'Court Name'));
  ld.judge = firstNonEmpty(field(s, 'caseSummary', 'Judge'), field(s, 'caseSummary', 'Judge Name'));
  ld.filed_date = parseDate(firstNonEmpty(field(s, 'caseSummary', 'Filed Date'), field(s, 'caseSummary', 'Date Filed')));
  ld.opposing_counsel = firstNonEmpty(field(s, 'caseSummary', 'Opposing Counsel'), field(s, 'caseSummary', 'Defense Attorney'));
  ld.opposing_firm = firstNonEmpty(field(s, 'caseSummary', 'Opposing Firm'), field(s, 'caseSummary', 'Defense Firm'));
  ld.opposing_phone = cleanPhone(field(s, 'caseSummary', 'Opposing Phone'));
  ld.opposing_email = cleanEmail(field(s, 'caseSummary', 'Opposing Email'));
  ld.trial_date = parseDate(field(s, 'caseSummary', 'Trial Date'));
  ld.mediation_date = parseDate(field(s, 'caseSummary', 'Mediation Date'));
  ld.discovery_deadline = parseDate(firstNonEmpty(field(s, 'caseSummary', 'Discovery Deadline'), field(s, 'caseSummary', 'Discovery Cutoff')));

  const hasData = Object.entries(ld).some(([k, v]) => k !== 'case_id' && v != null);
  return hasData ? ld : null;
}

function extractNegotiations(sc, caseId) {
  const s = sc.sections || {};
  const rows = [];

  // From negotiations section tables
  const negTables = s.negotiations?.tables || [];
  for (const table of negTables) {
    if (!Array.isArray(table)) continue;
    for (const row of table) {
      const type = mapNegotiationType(row.Type || row.type || row['Negotiation Type']);
      const amount = parseAmount(row.Amount || row.amount);
      const date = parseDate(row.Date || row.date);
      if (!type || amount == null || !date) continue;
      // Validate type against allowed values
      const validTypes = ['bottom_line','plaintiff_offer','defendant_offer','presuit_demand','settlement','undisputed_payment','denial','appraisal_award'];
      if (!validTypes.includes(type)) continue;
      rows.push({
        case_id: caseId,
        type,
        amount,
        date,
        notes: row.Notes || row.notes || null,
        by_name: row['By'] || row.by || row.by_name || null,
      });
    }
  }

  // From negotiations section fields (individual named amounts)
  const negFields = s.negotiations?.fields || {};
  const fieldMappings = [
    { keys: ['Bottom Line', 'Bottom Line Amount'], type: 'bottom_line' },
    { keys: ['Presuit Demand', 'Demand Amount', 'Demand'], type: 'presuit_demand' },
    { keys: ['Settlement Amount', 'Settlement'], type: 'settlement' },
    { keys: ['Appraisal Award', 'Appraisal Award Amount'], type: 'appraisal_award' },
    { keys: ['Undisputed Payment', 'Undisputed Amount'], type: 'undisputed_payment' },
  ];
  for (const mapping of fieldMappings) {
    for (const key of mapping.keys) {
      const val = negFields[key];
      if (val) {
        const amount = parseAmount(val);
        const dateKey = key.replace('Amount', 'Date').replace(/ $/, '') + ' Date';
        const date = parseDate(negFields[dateKey] || negFields['Date']) || parseDate(field(sc.sections, 'caseSummary', 'Date of Loss'));
        if (amount != null && date) {
          // Avoid duplicates with table rows
          const dup = rows.find(r => r.type === mapping.type && r.amount === amount);
          if (!dup) {
            rows.push({ case_id: caseId, type: mapping.type, amount, date, notes: null, by_name: null });
          }
        }
        break;
      }
    }
  }

  return rows;
}

function extractEstimates(sc, caseId) {
  const s = sc.sections || {};
  const rows = [];

  // From expenses section tables
  const expTables = s.expenses?.tables || [];
  for (const table of expTables) {
    if (!Array.isArray(table)) continue;
    for (const row of table) {
      const type = row.Type || row.type || row['Expense Type'] || row['Estimate Type'] || 'Unknown';
      const amount = parseAmount(row.Amount || row.amount || row.Cost || row.cost);
      const date = parseDate(row.Date || row.date);
      if (amount == null) continue;
      rows.push({
        case_id: caseId,
        type: type.trim(),
        vendor: row.Vendor || row.vendor || row['Company'] || row['Expert'] || null,
        amount,
        date: date || '1970-01-01', // date is NOT NULL in schema
        notes: row.Notes || row.notes || row.Description || row.description || null,
      });
    }
  }

  // From estimates section if separate
  const estTables = s.experts?.tables || [];
  for (const table of estTables) {
    if (!Array.isArray(table)) continue;
    for (const row of table) {
      const type = row.Type || row.type || row['Expert Type'] || 'Expert';
      const amount = parseAmount(row.Amount || row.amount || row.Fee || row.fee || row.Cost);
      const date = parseDate(row.Date || row.date);
      if (amount == null) continue;
      rows.push({
        case_id: caseId,
        type: type.trim(),
        vendor: row.Name || row.name || row.Expert || row.expert || row.Vendor || null,
        amount,
        date: date || '1970-01-01',
        notes: row.Notes || row.notes || row.Specialty || row.specialty || null,
      });
    }
  }

  return rows;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(COMMIT ? '🔥 COMMIT MODE — writing to Supabase' : '🔍 DRY RUN — pass --commit to write\n');

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ Data file not found: ${DATA_PATH}`);
    console.error('   Place the V2 scraper output at data/filevine-full-data.json');
    process.exit(1);
  }

  const scraped = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`📂 Loaded ${scraped.length} cases from filevine-full-data.json`);

  // Fetch all existing cases
  const { data: existing, error } = await supabase
    .from('cases')
    .select('*');
  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`📊 ${existing.length} cases in Supabase\n`);

  // Build name lookup
  const nameMap = new Map();
  existing.forEach(c => {
    const key = normalize(c.client_name);
    if (key) nameMap.set(key, c);
  });

  // Check existing claim_details / litigation_details to avoid duplicates
  const { data: existingClaims } = await supabase.from('claim_details').select('case_id');
  const { data: existingLit } = await supabase.from('litigation_details').select('case_id');
  const { data: existingNeg } = await supabase.from('negotiations').select('case_id, type, amount');
  const { data: existingEst } = await supabase.from('estimates').select('case_id, type, amount');

  const claimCaseIds = new Set((existingClaims || []).map(r => r.case_id));
  const litCaseIds = new Set((existingLit || []).map(r => r.case_id));
  const negKeys = new Set((existingNeg || []).map(r => `${r.case_id}:${r.type}:${r.amount}`));
  const estKeys = new Set((existingEst || []).map(r => `${r.case_id}:${r.type}:${r.amount}`));

  // Stats
  let matched = 0, skipped = 0;
  const caseUpdates = [];
  const claimInserts = [];
  const litInserts = [];
  const negInserts = [];
  const estInserts = [];

  for (const sc of scraped) {
    const scKey = normalize(sc.projectName);
    const match = nameMap.get(scKey);
    if (!match) { skipped++; continue; }
    matched++;

    // Case updates
    const patch = extractCasePatch(sc, match);
    if (Object.keys(patch).length > 0) {
      caseUpdates.push({ id: match.id, name: match.client_name, patch });
    }

    // Claim details (1:1, skip if exists)
    if (!claimCaseIds.has(match.id)) {
      const cd = extractClaimDetails(sc, match.id);
      if (cd) claimInserts.push({ name: match.client_name, data: cd });
    }

    // Litigation details (1:1, skip if exists)
    if (!litCaseIds.has(match.id)) {
      const ld = extractLitigationDetails(sc, match.id);
      if (ld) litInserts.push({ name: match.client_name, data: ld });
    }

    // Negotiations (many, deduplicate)
    const negs = extractNegotiations(sc, match.id);
    for (const neg of negs) {
      const key = `${neg.case_id}:${neg.type}:${neg.amount}`;
      if (!negKeys.has(key)) {
        negInserts.push({ name: match.client_name, data: neg });
        negKeys.add(key);
      }
    }

    // Estimates (many, deduplicate)
    const ests = extractEstimates(sc, match.id);
    for (const est of ests) {
      const key = `${est.case_id}:${est.type}:${est.amount}`;
      if (!estKeys.has(key)) {
        estInserts.push({ name: match.client_name, data: est });
        estKeys.add(key);
      }
    }
  }

  // ── Report ──────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  ENRICHMENT REPORT');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`  Matched:    ${matched}/${scraped.length}`);
  console.log(`  No match:   ${skipped}\n`);

  if (caseUpdates.length) {
    console.log(`📝 CASE UPDATES (${caseUpdates.length}):`);
    for (const u of caseUpdates) {
      console.log(`  ✏️  ${u.name}`);
      for (const [k, v] of Object.entries(u.patch)) {
        console.log(`      ${k}: ${v}`);
      }
    }
    console.log();
  }

  if (claimInserts.length) {
    console.log(`📋 CLAIM DETAILS INSERTS (${claimInserts.length}):`);
    for (const ci of claimInserts) {
      const fields = Object.entries(ci.data).filter(([k, v]) => k !== 'case_id' && v != null);
      console.log(`  ➕ ${ci.name} — ${fields.length} fields: ${fields.map(([k]) => k).join(', ')}`);
    }
    console.log();
  }

  if (litInserts.length) {
    console.log(`⚖️  LITIGATION DETAILS INSERTS (${litInserts.length}):`);
    for (const li of litInserts) {
      const fields = Object.entries(li.data).filter(([k, v]) => k !== 'case_id' && v != null);
      console.log(`  ➕ ${li.name} — ${fields.length} fields: ${fields.map(([k]) => k).join(', ')}`);
    }
    console.log();
  }

  if (negInserts.length) {
    console.log(`💰 NEGOTIATION INSERTS (${negInserts.length}):`);
    for (const ni of negInserts) {
      console.log(`  ➕ ${ni.name} — ${ni.data.type}: $${ni.data.amount} on ${ni.data.date}`);
    }
    console.log();
  }

  if (estInserts.length) {
    console.log(`📊 ESTIMATE INSERTS (${estInserts.length}):`);
    for (const ei of estInserts) {
      console.log(`  ➕ ${ei.name} — ${ei.data.type}: $${ei.data.amount}${ei.data.vendor ? ` (${ei.data.vendor})` : ''}`);
    }
    console.log();
  }

  const totalChanges = caseUpdates.length + claimInserts.length + litInserts.length + negInserts.length + estInserts.length;
  if (totalChanges === 0) {
    console.log('✅ Nothing to update — all data is current.');
    return;
  }

  // ── Commit ──────────────────────────────────────────────────
  if (!COMMIT) {
    console.log(`\n💡 ${totalChanges} total changes. Run with --commit to apply.`);
    return;
  }

  console.log('\n🔥 Committing changes...\n');
  let ok = 0, fail = 0;

  // Case updates
  for (const u of caseUpdates) {
    const { error } = await supabase.from('cases').update(u.patch).eq('id', u.id);
    if (error) { console.error(`  ❌ cases/${u.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  // Claim details — strip nulls before insert
  for (const ci of claimInserts) {
    const clean = Object.fromEntries(Object.entries(ci.data).filter(([, v]) => v != null));
    const { error } = await supabase.from('claim_details').insert(clean);
    if (error) { console.error(`  ❌ claim_details/${ci.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  // Litigation details
  for (const li of litInserts) {
    const clean = Object.fromEntries(Object.entries(li.data).filter(([, v]) => v != null));
    const { error } = await supabase.from('litigation_details').insert(clean);
    if (error) { console.error(`  ❌ litigation_details/${li.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  // Negotiations
  for (const ni of negInserts) {
    const { error } = await supabase.from('negotiations').insert(ni.data);
    if (error) { console.error(`  ❌ negotiations/${ni.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  // Estimates
  for (const ei of estInserts) {
    const { error } = await supabase.from('estimates').insert(ei.data);
    if (error) { console.error(`  ❌ estimates/${ei.name}: ${error.message}`); fail++; }
    else { ok++; }
  }

  console.log(`\n✅ ${ok} succeeded, ❌ ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
