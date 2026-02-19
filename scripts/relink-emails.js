#!/usr/bin/env node
/**
 * Re-link emails that have null matched_by to correct cases.
 * Matches by: client_email, adjuster_email, client name in subject/body,
 * case ref (DC-XXXX) in subject, insurer name in from/to/subject.
 * 
 * Usage: node scripts/relink-emails.js          # dry run
 *        node scripts/relink-emails.js --commit  # write
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const COMMIT = process.argv.includes("--commit");

const FIRM_EMAILS = new Set([
  "bart@denham.law", "andrew@denham.law", "joey@denham.law",
  "chris@denham.law", "info@denham.law", "office@denham.law"
]);

function norm(s) { return (s || "").toLowerCase().trim(); }

async function main() {
  console.log(`\n📧 Email Re-linker — ${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

  // Load all cases
  const { data: cases } = await sb.from("cases").select("id, ref, client_name, client_email, adjuster_email, insurer, claim_number");

  // Build lookup maps
  const emailToCase = {}; // email address -> case
  const refToCase = {};   // DC-XXXX -> case
  const nameTokens = {};  // normalized last name -> [cases]

  for (const c of cases) {
    if (c.client_email) emailToCase[norm(c.client_email)] = c;
    if (c.adjuster_email) emailToCase[norm(c.adjuster_email)] = c;
    if (c.ref) refToCase[norm(c.ref)] = c;
    
    // Name tokens (last names, significant words)
    const parts = (c.client_name || "").split(/[\s,]+/).filter(p => p.length >= 3);
    for (const p of parts) {
      const n = norm(p);
      if (!nameTokens[n]) nameTokens[n] = [];
      nameTokens[n].push(c);
    }
  }

  // Load unmatched emails (matched_by is null)
  const unmatched = [];
  for (let i = 0; ; i++) {
    const { data } = await sb.from("case_emails")
      .select("id, case_id, subject, from_address, to_address, cc_address, matched_by")
      .is("matched_by", null)
      .range(i * 1000, (i + 1) * 1000 - 1);
    if (!data || !data.length) break;
    unmatched.push(...data);
  }
  console.log(`Unmatched emails: ${unmatched.length}`);

  const updates = [];
  
  for (const email of unmatched) {
    const allAddrs = [email.from_address, email.to_address, email.cc_address]
      .filter(Boolean).join(",").split(/[,;]/).map(a => {
        const m = a.match(/[\w.+-]+@[\w.-]+/);
        return m ? norm(m[0]) : null;
      }).filter(a => a && !FIRM_EMAILS.has(a));

    let match = null;
    let matchMethod = null;

    // 1. Match by email address
    for (const addr of allAddrs) {
      if (emailToCase[addr]) {
        match = emailToCase[addr];
        matchMethod = `email:${addr}`;
        break;
      }
    }

    // 2. Match by case ref in subject (DC-XXXX pattern)
    if (!match && email.subject) {
      const refMatch = email.subject.match(/DC-\d{3,4}/i);
      if (refMatch && refToCase[norm(refMatch[0])]) {
        match = refToCase[norm(refMatch[0])];
        matchMethod = `ref:${refMatch[0]}`;
      }
    }

    // 3. Match by client name in subject
    if (!match && email.subject) {
      const subNorm = norm(email.subject);
      for (const c of cases) {
        const lastName = norm((c.client_name || "").split(/[\s,]+/)[0]);
        if (lastName.length >= 4 && subNorm.includes(lastName)) {
          // Check if unique
          const matches = nameTokens[lastName];
          if (matches && matches.length === 1) {
            match = c;
            matchMethod = `subject_name:${lastName}`;
            break;
          }
        }
      }
    }

    // 4. Match by claim number in subject
    if (!match && email.subject) {
      for (const c of cases) {
        if (c.claim_number && c.claim_number.length >= 5) {
          if (norm(email.subject).includes(norm(c.claim_number))) {
            match = c;
            matchMethod = `claim:${c.claim_number}`;
            break;
          }
        }
      }
    }

    if (match) {
      updates.push({
        id: email.id,
        case_id: match.id,
        matched_by: matchMethod
      });
    }
  }

  console.log(`Matched: ${updates.length} / ${unmatched.length}`);
  console.log(`Unmatched remaining: ${unmatched.length - updates.length}\n`);

  // Show sample matches
  for (const u of updates.slice(0, 10)) {
    const c = cases.find(c => c.id === u.case_id);
    console.log(`  ${u.matched_by} -> ${c?.ref} ${c?.client_name}`);
  }

  if (!COMMIT) {
    console.log("\n⚠️  Dry run. Use --commit to write.\n");
    return;
  }

  let success = 0, errors = 0;
  for (const u of updates) {
    const { error } = await sb.from("case_emails")
      .update({ case_id: u.case_id, matched_by: u.matched_by })
      .eq("id", u.id);
    if (error) { errors++; } else { success++; }
  }
  console.log(`\n✅ Updated: ${success}, Errors: ${errors}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
