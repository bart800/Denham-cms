#!/usr/bin/env node
/**
 * Fix data quality issues:
 * 1. Fill missing SOL dates from DOL + jurisdiction-based statute periods
 * 2. Fill missing insurers from case name patterns (e.g. "v. State Farm")
 * 3. Fill missing insurers from adjuster email domains or email content
 * 
 * Usage: node scripts/fix-data-quality.js          # dry run
 *        node scripts/fix-data-quality.js --commit  # write
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const COMMIT = process.argv.includes("--commit");

// Statute of limitations by state and case type (in years)
const SOL_YEARS = {
  "KY": { "Property Casualty": 5, "Personal Injury": 1, default: 5 },
  "TN": { "Property Casualty": 3, "Personal Injury": 1, default: 3 },
  "MT": { "Property Casualty": 5, "Personal Injury": 3, default: 5 },
  "NC": { "Property Casualty": 3, "Personal Injury": 3, default: 3 },
  "TX": { "Property Casualty": 2, "Personal Injury": 2, default: 2 },
  "CA": { "Property Casualty": 3, "Personal Injury": 2, default: 3 },
  "WA": { "Property Casualty": 3, "Personal Injury": 3, default: 3 },
  "CO": { "Property Casualty": 3, "Personal Injury": 3, default: 3 },
  "NY": { "Property Casualty": 6, "Personal Injury": 3, default: 6 },
  default: { default: 5 },
};

// Known insurer patterns in case names
const INSURER_PATTERNS = [
  { pattern: /\bstate\s*farm\b/i, insurer: "State Farm" },
  { pattern: /\ballstate\b/i, insurer: "Allstate" },
  { pattern: /\bfarmers\b/i, insurer: "Farmers" },
  { pattern: /\bkentucky\s*farm\s*bureau\b/i, insurer: "Kentucky Farm Bureau" },
  { pattern: /\berie\b/i, insurer: "Erie Insurance" },
  { pattern: /\bnationwide\b/i, insurer: "Nationwide" },
  { pattern: /\bprogressive\b/i, insurer: "Progressive" },
  { pattern: /\bgeico\b/i, insurer: "GEICO" },
  { pattern: /\busaa\b/i, insurer: "USAA" },
  { pattern: /\btravelers\b/i, insurer: "Travelers" },
  { pattern: /\bliberty\s*mutual\b/i, insurer: "Liberty Mutual" },
  { pattern: /\bamica\b/i, insurer: "Amica" },
  { pattern: /\bauto[-\s]?owners\b/i, insurer: "Auto-Owners" },
  { pattern: /\bcincinnati\b/i, insurer: "Cincinnati Insurance" },
  { pattern: /\bwestfield\b/i, insurer: "Westfield" },
  { pattern: /\bgrange\b/i, insurer: "Grange Insurance" },
  { pattern: /\bshelter\b/i, insurer: "Shelter Insurance" },
  { pattern: /\bamerican\s*family\b/i, insurer: "American Family" },
  { pattern: /\bchubb\b/i, insurer: "Chubb" },
  { pattern: /\bhartford\b/i, insurer: "The Hartford" },
  { pattern: /\bsafeco\b/i, insurer: "Safeco" },
];

// Email domain to insurer
const DOMAIN_INSURER = {
  "statefarm.com": "State Farm",
  "allstate.com": "Allstate",
  "farmers.com": "Farmers",
  "kyfb.com": "Kentucky Farm Bureau",
  "erieinsurance.com": "Erie Insurance",
  "nationwide.com": "Nationwide",
  "progressive.com": "Progressive",
  "geico.com": "GEICO",
  "usaa.com": "USAA",
  "travelers.com": "Travelers",
  "libertymutual.com": "Liberty Mutual",
};

function addYears(dateStr, years) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log(`\n🔧 Data Quality Fixer — ${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

  const { data: cases } = await sb.from("cases").select("id, ref, client_name, date_of_loss, jurisdiction, type, statute_of_limitations, insurer, adjuster_email, status");
  const active = cases.filter(c => c.status !== "Closed" && c.status !== "Referred");

  const updates = [];

  // 1. Fix missing SOL dates
  const missingSol = active.filter(c => !c.statute_of_limitations && c.date_of_loss);
  console.log(`Cases missing SOL (with DOL): ${missingSol.length}`);

  for (const c of missingSol) {
    const stateRules = SOL_YEARS[c.jurisdiction] || SOL_YEARS.default;
    const years = stateRules[c.type] || stateRules.default;
    const sol = addYears(c.date_of_loss, years);
    updates.push({ id: c.id, field: "statute_of_limitations", value: sol, reason: `${c.jurisdiction || "?"} ${c.type || "?"} = ${years}yr from DOL` });
    console.log(`  ${c.ref} ${c.client_name}: SOL = ${sol} (${years}yr from ${c.date_of_loss})`);
  }

  // 2. Fix missing insurers from case name
  const missingInsurer = active.filter(c => !c.insurer);
  console.log(`\nCases missing insurer: ${missingInsurer.length}`);

  let insurerFromName = 0, insurerFromEmail = 0, insurerFromAdj = 0;

  for (const c of missingInsurer) {
    let foundInsurer = null;

    // Try case name
    for (const { pattern, insurer } of INSURER_PATTERNS) {
      if (pattern.test(c.client_name)) {
        foundInsurer = insurer;
        insurerFromName++;
        break;
      }
    }

    // Try adjuster email domain
    if (!foundInsurer && c.adjuster_email) {
      const domain = c.adjuster_email.split("@")[1]?.toLowerCase();
      if (domain && DOMAIN_INSURER[domain]) {
        foundInsurer = DOMAIN_INSURER[domain];
        insurerFromAdj++;
      }
    }

    // Try emails associated with this case
    if (!foundInsurer) {
      const { data: emails } = await sb.from("case_emails")
        .select("from_address, to_address")
        .eq("case_id", c.id)
        .limit(20);

      if (emails) {
        const allAddrs = emails.map(e => [e.from_address, e.to_address].join(",")).join(",");
        for (const [domain, insurer] of Object.entries(DOMAIN_INSURER)) {
          if (allAddrs.includes(domain)) {
            foundInsurer = insurer;
            insurerFromEmail++;
            break;
          }
        }
      }
    }

    if (foundInsurer) {
      updates.push({ id: c.id, field: "insurer", value: foundInsurer, reason: `inferred` });
      console.log(`  ${c.ref} ${c.client_name}: insurer = ${foundInsurer}`);
    }
  }

  console.log(`\nInsurer matches: name=${insurerFromName} adjEmail=${insurerFromAdj} caseEmails=${insurerFromEmail}`);
  console.log(`Total updates: ${updates.length}\n`);

  if (!COMMIT) {
    console.log("⚠️  Dry run. Use --commit to write.\n");
    return;
  }

  let success = 0, errors = 0;
  for (const u of updates) {
    const { error } = await sb.from("cases").update({ [u.field]: u.value }).eq("id", u.id);
    if (error) { errors++; console.error(`Error ${u.field} for ${u.id}:`, error.message); }
    else success++;
  }
  console.log(`\n✅ Updated: ${success}, Errors: ${errors}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
