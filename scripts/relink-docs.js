#!/usr/bin/env node
/**
 * Re-link documents to cases by matching folder names to client names.
 * Usage: node scripts/relink-docs.js          # dry run
 *        node scripts/relink-docs.js --commit  # write
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const COMMIT = process.argv.includes("--commit");

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  console.log(`\n📂 Document Re-linker — ${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

  // Load cases
  const { data: cases } = await sb.from("cases").select("id, client_name");
  console.log(`Loaded ${cases.length} cases`);

  // Build lookup maps
  const exactMap = {};  // normalized name -> case
  const partMap = {};   // first significant word -> [cases]
  const reversedMap = {}; // "lastname firstname" and "firstname lastname" variants
  for (const c of cases) {
    const norm = normalize(c.client_name);
    exactMap[norm] = c;
    // Also try "LastName, FirstName" -> "lastname"
    const parts = c.client_name.split(/[,\s]+/).filter(Boolean);
    if (parts[0] && parts[0].length >= 3) {
      const key = normalize(parts[0]);
      if (!partMap[key]) partMap[key] = [];
      partMap[key].push(c);
    }
    // Build reversed name variants: "Cynthia Boger" -> also match "Boger, Cynthia"
    if (parts.length >= 2) {
      // Original order
      const fwd = normalize(parts.join(""));
      exactMap[fwd] = c;
      // Reversed
      const rev = normalize([...parts].reverse().join(""));
      exactMap[rev] = c;
      // Just last,first and first,last with common separators removed
      for (let i = 0; i < parts.length; i++) {
        for (let j = 0; j < parts.length; j++) {
          if (i !== j) {
            exactMap[normalize(parts[i] + parts[j])] = c;
          }
        }
      }
    }
  }

  // Load all unlinked docs
  const allDocs = [];
  for (let i = 0; ; i++) {
    const { data } = await sb
      .from("documents")
      .select("id, original_path")
      .is("case_id", null)
      .range(i * 1000, (i + 1) * 1000 - 1);
    if (!data || !data.length) break;
    allDocs.push(...data);
  }
  console.log(`Unlinked docs: ${allDocs.length}\n`);

  // Match by folder name
  const updates = {}; // case_id -> [doc_ids]
  let matched = 0, unmatched = 0;
  const unmatchedFolders = {};

  for (const doc of allDocs) {
    const p = doc.original_path || "";
    const pathParts = p.split(/[\\/]/);
    let topFolder = pathParts[0].trim();
    // For "CLOSED/ClientName/..." use the second folder
    if (topFolder.toUpperCase() === "CLOSED" && pathParts[1]) {
      topFolder = pathParts[1].trim();
    }
    // For "Attachments/..." try second folder too
    if (topFolder === "Attachments" && pathParts[1]) {
      topFolder = pathParts[1].trim();
    }
    if (!topFolder) { unmatched++; continue; }

    // Try exact normalized match
    const normFolder = normalize(topFolder);
    let match = exactMap[normFolder];

    // Try removing common suffixes like "copy", "old", numbers
    if (!match) {
      const cleaned = topFolder
        .replace(/\s*copy\s*\d*$/i, "")
        .replace(/\s*\(\d+\)$/, "")
        .replace(/\.\s*/g, ", ")  // "Carpenter. Greg" -> "Carpenter, Greg"
        .trim();
      match = exactMap[normalize(cleaned)];
    }

    // Try last-name-only match (if unique)
    if (!match) {
      const firstWord = normalize(topFolder.split(/[,.\s]+/)[0]);
      if (firstWord.length >= 4 && partMap[firstWord] && partMap[firstWord].length === 1) {
        match = partMap[firstWord][0];
      }
    }

    // Try substring: folder contains case name or vice versa
    if (!match) {
      for (const c of cases) {
        const cn = normalize(c.client_name);
        if (cn.length >= 5 && (normFolder.includes(cn) || cn.includes(normFolder))) {
          match = c;
          break;
        }
      }
    }

    if (match) {
      if (!updates[match.id]) updates[match.id] = [];
      updates[match.id].push(doc.id);
      matched++;
    } else {
      unmatched++;
      unmatchedFolders[topFolder] = (unmatchedFolders[topFolder] || 0) + 1;
    }
  }

  const caseCount = Object.keys(updates).length;
  console.log(`Matched: ${matched} docs across ${caseCount} cases`);
  console.log(`Unmatched: ${unmatched} docs`);
  console.log(`\nTop unmatched folders:`);
  Object.entries(unmatchedFolders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([f, c]) => console.log(`  ${c} — ${f}`));

  if (!COMMIT) {
    console.log("\n⚠️  Dry run. Use --commit to write.\n");
    return;
  }

  // Update in batches
  let updated = 0, errors = 0;
  for (const [caseId, docIds] of Object.entries(updates)) {
    // Update in chunks of 500
    for (let i = 0; i < docIds.length; i += 500) {
      const batch = docIds.slice(i, i + 500);
      const { error } = await sb
        .from("documents")
        .update({ case_id: caseId })
        .in("id", batch);
      if (error) {
        console.error(`Error updating ${batch.length} docs for case ${caseId}:`, error.message);
        errors += batch.length;
      } else {
        updated += batch.length;
      }
    }
  }

  console.log(`\n✅ Updated: ${updated}, Errors: ${errors}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
