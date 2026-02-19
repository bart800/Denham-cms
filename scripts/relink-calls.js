#!/usr/bin/env node
/**
 * Enhanced call re-linker. Matches unlinked calls to cases by:
 * 1. Phone number (client, adjuster, opposing counsel, contacts)
 * 2. Caller name matching client name
 * 3. Caller name matching adjuster/opposing counsel
 * 4. Transcript/summary content matching client name or case ref
 * 
 * Usage: node scripts/relink-calls.js          # dry run
 *        node scripts/relink-calls.js --commit  # write
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
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1);
  if (digits.length === 10) return digits;
  if (digits.length === 7) return digits; // local
  return digits;
}

function normName(n) {
  return (n || "").toLowerCase().replace(/[^a-z]/g, "");
}

async function main() {
  console.log(`\n📞 Enhanced Call Re-linker — ${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

  // Load cases
  const { data: cases } = await sb.from("cases").select("id, ref, client_name, client_phone, client_email, adjuster_name, adjuster_phone, adjuster_email, insurer");
  
  // Load litigation details
  const { data: litDetails } = await sb.from("litigation_details").select("case_id, opposing_counsel, opposing_phone");
  const litMap = {};
  for (const ld of litDetails || []) litMap[ld.case_id] = ld;

  // Load contacts with phones
  const { data: caseContacts } = await sb.from("case_contacts").select("case_id, contact_id, role");
  const { data: contacts } = await sb.from("contacts").select("id, first_name, last_name, phone, email, company");
  
  const contactMap = {};
  for (const c of contacts || []) contactMap[c.id] = c;

  // Build phone -> case lookup
  const phoneToCase = {}; // normalized phone -> { case, type }
  
  for (const c of cases) {
    const cp = normalizePhone(c.client_phone);
    if (cp) phoneToCase[cp] = { case: c, type: "client" };
    const ap = normalizePhone(c.adjuster_phone);
    if (ap) phoneToCase[ap] = { case: c, type: "adjuster" };
    const ld = litMap[c.id];
    if (ld) {
      const op = normalizePhone(ld.opposing_phone);
      if (op) phoneToCase[op] = { case: c, type: "opposing_counsel" };
    }
  }

  // Add contact phones
  for (const cc of caseContacts || []) {
    const contact = contactMap[cc.contact_id];
    if (contact && contact.phone) {
      const p = normalizePhone(contact.phone);
      if (p) phoneToCase[p] = { case: cases.find(c => c.id === cc.case_id), type: cc.role || "contact" };
    }
  }

  // Build client name lookup
  const clientNameMap = {}; // normalized full name or last name -> [cases]
  for (const c of cases) {
    if (!c.client_name) continue;
    const full = normName(c.client_name);
    if (!clientNameMap[full]) clientNameMap[full] = [];
    clientNameMap[full].push({ case: c, type: "client" });
    
    // Last name (first token before comma or space)
    const parts = c.client_name.split(/[\s,]+/).filter(Boolean);
    for (const p of parts) {
      const n = normName(p);
      if (n.length >= 4) {
        if (!clientNameMap[n]) clientNameMap[n] = [];
        clientNameMap[n].push({ case: c, type: "client" });
      }
    }
  }

  // Build adjuster/opposing name lookup
  const otherNameMap = {};
  for (const c of cases) {
    if (c.adjuster_name) {
      const n = normName(c.adjuster_name);
      if (n.length >= 4) {
        if (!otherNameMap[n]) otherNameMap[n] = [];
        otherNameMap[n].push({ case: c, type: "adjuster" });
      }
      // Also individual parts
      for (const p of c.adjuster_name.split(/[\s,]+/).filter(Boolean)) {
        const pn = normName(p);
        if (pn.length >= 4) {
          if (!otherNameMap[pn]) otherNameMap[pn] = [];
          otherNameMap[pn].push({ case: c, type: "adjuster" });
        }
      }
    }
    const ld = litMap[c.id];
    if (ld && ld.opposing_counsel) {
      const n = normName(ld.opposing_counsel);
      if (n.length >= 4) {
        if (!otherNameMap[n]) otherNameMap[n] = [];
        otherNameMap[n].push({ case: c, type: "opposing_counsel" });
      }
    }
  }

  console.log(`Cases: ${cases.length}`);
  console.log(`Phone lookup: ${Object.keys(phoneToCase).length} entries`);
  console.log(`Client name lookup: ${Object.keys(clientNameMap).length} entries`);
  console.log(`Other name lookup: ${Object.keys(otherNameMap).length} entries`);

  // Load all unlinked calls
  const unlinked = [];
  for (let i = 0; ; i++) {
    const { data } = await sb.from("case_calls")
      .select("id, case_id, external_number, caller_name, caller_email, contact_type, ai_summary, transcript")
      .is("case_id", null)
      .range(i * 1000, (i + 1) * 1000 - 1);
    if (!data || !data.length) break;
    unlinked.push(...data);
  }
  console.log(`Unlinked calls: ${unlinked.length}\n`);

  const updates = [];
  const methodCounts = {};

  for (const call of unlinked) {
    let match = null;
    let method = null;

    // 1. Phone match
    const p = normalizePhone(call.external_number);
    if (p && phoneToCase[p]) {
      match = phoneToCase[p].case;
      method = "phone";
    }

    // 2. Caller email match
    if (!match && call.caller_email) {
      const email = call.caller_email.toLowerCase();
      for (const c of cases) {
        if (c.client_email && c.client_email.toLowerCase() === email) {
          match = c; method = "caller_email"; break;
        }
        if (c.adjuster_email && c.adjuster_email.toLowerCase() === email) {
          match = c; method = "adjuster_email"; break;
        }
      }
    }

    // 3. Caller name matches client name (exact or close)
    if (!match && call.caller_name) {
      const cn = normName(call.caller_name);
      if (cn.length >= 4) {
        // Exact match
        if (clientNameMap[cn] && clientNameMap[cn].length === 1) {
          match = clientNameMap[cn][0].case;
          method = "client_name_exact";
        }
        // Try each word of caller name
        if (!match) {
          const callerParts = call.caller_name.split(/[\s,]+/).filter(Boolean);
          for (const part of callerParts) {
            const pn = normName(part);
            if (pn.length >= 4 && clientNameMap[pn] && clientNameMap[pn].length === 1) {
              match = clientNameMap[pn][0].case;
              method = "client_name_partial";
              break;
            }
          }
        }
        // Try adjuster/opposing names
        if (!match) {
          if (otherNameMap[cn] && otherNameMap[cn].length === 1) {
            match = otherNameMap[cn][0].case;
            method = "other_name_exact";
          }
          if (!match) {
            const callerParts = call.caller_name.split(/[\s,]+/).filter(Boolean);
            for (const part of callerParts) {
              const pn = normName(part);
              if (pn.length >= 4 && otherNameMap[pn] && otherNameMap[pn].length === 1) {
                match = otherNameMap[pn][0].case;
                method = "other_name_partial";
                break;
              }
            }
          }
        }
      }
    }

    // 4. Case ref in summary or transcript
    if (!match && (call.ai_summary || call.transcript)) {
      const text = ((call.ai_summary || "") + " " + (call.transcript || "")).toLowerCase();
      const refMatch = text.match(/dc-\d{3,4}/);
      if (refMatch) {
        const c = cases.find(c => c.ref && c.ref.toLowerCase() === refMatch[0]);
        if (c) { match = c; method = "transcript_ref"; }
      }
    }

    // 5. Client name in summary (unique match only)
    if (!match && call.ai_summary) {
      const summary = normName(call.ai_summary);
      for (const c of cases) {
        if (!c.client_name) continue;
        const lastName = normName(c.client_name.split(/[\s,]+/)[0]);
        if (lastName.length >= 5 && summary.includes(lastName)) {
          // Check uniqueness
          if (clientNameMap[lastName] && clientNameMap[lastName].length === 1) {
            match = c;
            method = "summary_name";
            break;
          }
        }
      }
    }

    if (match) {
      updates.push({ id: call.id, case_id: match.id, contact_type: method.includes("client") ? "client" : method.includes("adjuster") ? "adjuster" : null });
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    }
  }

  console.log(`Total matches: ${updates.length} / ${unlinked.length}`);
  console.log(`Match methods:`, methodCounts);
  console.log(`Still unlinked: ${unlinked.length - updates.length}\n`);

  if (!COMMIT) {
    console.log("⚠️  Dry run. Use --commit to write.\n");
    return;
  }

  // Batch update
  let success = 0, errors = 0;
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const patch = { case_id: u.case_id };
    if (u.contact_type) patch.contact_type = u.contact_type;
    const { error } = await sb.from("case_calls").update(patch).eq("id", u.id);
    if (error) { errors++; if (errors <= 3) console.error(error.message); }
    else success++;
    if ((i + 1) % 200 === 0) console.log(`  Progress: ${i + 1}/${updates.length}`);
  }
  console.log(`\n✅ Updated: ${success}, Errors: ${errors}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
