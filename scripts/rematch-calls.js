#!/usr/bin/env node
/**
 * Re-match unmatched Dialpad calls to cases by adjuster name, opposing counsel, etc.
 * Also tags existing matched calls with contact_type.
 * 
 * Usage: node scripts/rematch-calls.js          # dry run
 *        node scripts/rematch-calls.js --commit  # write
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const COMMIT = process.argv.includes("--commit");

function normalizePhone(p) {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") return "+1" + digits.slice(1);
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
}

function normalizeName(n) {
  return (n || "").toLowerCase().replace(/[^a-z]/g, "");
}

async function main() {
  console.log(`\n📞 Call Re-matcher — ${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

  // Load cases with all contact info
  const { data: cases } = await sb.from("cases").select("id, client_name, client_phone, adjuster_name, adjuster_phone, adjuster_email");
  
  // Load litigation details for opposing counsel
  const { data: litDetails } = await sb.from("litigation_details").select("case_id, opposing_counsel, opposing_phone");
  const litMap = {};
  for (const ld of litDetails || []) {
    litMap[ld.case_id] = ld;
  }

  // Build phone->case lookup (client phones)
  const phoneToCase = {};
  for (const c of cases) {
    const norm = normalizePhone(c.client_phone);
    if (norm) phoneToCase[norm] = { case: c, type: "client" };
    const adjNorm = normalizePhone(c.adjuster_phone);
    if (adjNorm) phoneToCase[adjNorm] = { case: c, type: "adjuster" };
    const ld = litMap[c.id];
    if (ld) {
      const oppNorm = normalizePhone(ld.opposing_phone);
      if (oppNorm) phoneToCase[oppNorm] = { case: c, type: "opposing_counsel" };
    }
  }

  // Build adjuster name -> cases (for name-based matching on unmatched calls)
  const adjusterNameMap = {}; // normalized name -> [{case, type}]
  for (const c of cases) {
    if (c.adjuster_name) {
      const norm = normalizeName(c.adjuster_name);
      if (norm.length >= 4) {
        if (!adjusterNameMap[norm]) adjusterNameMap[norm] = [];
        adjusterNameMap[norm].push({ case: c, type: "adjuster" });
      }
    }
    const ld = litMap[c.id];
    if (ld && ld.opposing_counsel) {
      const norm = normalizeName(ld.opposing_counsel);
      if (norm.length >= 4) {
        if (!adjusterNameMap[norm]) adjusterNameMap[norm] = [];
        adjusterNameMap[norm].push({ case: c, type: "opposing_counsel" });
      }
    }
  }

  console.log(`Cases: ${cases.length}`);
  console.log(`Phone lookup entries: ${Object.keys(phoneToCase).length}`);
  console.log(`Name lookup entries: ${Object.keys(adjusterNameMap).length}`);

  // Load all calls
  const allCalls = [];
  for (let i = 0; ; i++) {
    const { data } = await sb.from("case_calls").select("id, case_id, external_number, caller_name, contact_type").range(i * 1000, (i + 1) * 1000 - 1);
    if (!data || !data.length) break;
    allCalls.push(...data);
  }
  console.log(`Total calls: ${allCalls.length}`);

  const unmatched = allCalls.filter(c => !c.case_id);
  const matched = allCalls.filter(c => c.case_id);
  console.log(`Already matched: ${matched.length}`);
  console.log(`Unmatched: ${unmatched.length}\n`);

  const updates = []; // {id, case_id?, contact_type}

  // 1. Tag already-matched calls with contact_type (they were matched by client phone)
  for (const call of matched) {
    if (!call.contact_type) {
      updates.push({ id: call.id, contact_type: "client" });
    }
  }
  console.log(`Existing calls to tag as 'client': ${updates.length}`);

  // 2. Try to match unmatched calls
  let newMatches = 0;
  let nameMatches = 0;
  for (const call of unmatched) {
    const normPhone = normalizePhone(call.external_number);
    
    // Try phone match (adjuster/opposing phones)
    if (normPhone && phoneToCase[normPhone]) {
      const m = phoneToCase[normPhone];
      updates.push({ id: call.id, case_id: m.case.id, contact_type: m.type });
      newMatches++;
      continue;
    }

    // Try caller name match against adjuster/opposing counsel names
    if (call.caller_name) {
      const normCaller = normalizeName(call.caller_name);
      if (normCaller.length >= 4 && adjusterNameMap[normCaller]) {
        const matches = adjusterNameMap[normCaller];
        if (matches.length === 1) {
          // Unique match
          updates.push({ id: call.id, case_id: matches[0].case.id, contact_type: matches[0].type });
          nameMatches++;
          continue;
        }
      }
      // Try partial: caller last name matches adjuster last name
      const callerParts = call.caller_name.split(/[\s,]+/).filter(Boolean);
      for (const part of callerParts) {
        const normPart = normalizeName(part);
        if (normPart.length >= 4) {
          // Check if any adjuster name contains this part
          for (const [name, matches] of Object.entries(adjusterNameMap)) {
            if (name.includes(normPart) && matches.length === 1) {
              updates.push({ id: call.id, case_id: matches[0].case.id, contact_type: matches[0].type });
              nameMatches++;
              break;
            }
          }
          if (updates.find(u => u.id === call.id)) break;
        }
      }
    }
  }

  console.log(`New phone matches: ${newMatches}`);
  console.log(`New name matches: ${nameMatches}`);
  console.log(`Total updates: ${updates.length}\n`);

  if (!COMMIT) {
    console.log("⚠️  Dry run. Use --commit to write.\n");
    return;
  }

  // Apply updates in batches
  let success = 0, errors = 0;
  for (const u of updates) {
    const patch = {};
    if (u.contact_type) patch.contact_type = u.contact_type;
    if (u.case_id) patch.case_id = u.case_id;
    const { error } = await sb.from("case_calls").update(patch).eq("id", u.id);
    if (error) {
      errors++;
      if (errors <= 5) console.error(`Error: ${error.message}`);
    } else {
      success++;
    }
  }
  console.log(`\n✅ Updated: ${success}, Errors: ${errors}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
