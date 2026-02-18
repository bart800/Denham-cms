#!/usr/bin/env node
/**
 * Link unlinked documents to cases by matching folder names to case client_name.
 * 
 * Usage:
 *   node link-documents.js          # dry run
 *   node link-documents.js --commit # actually update the database
 */

const { Client } = require('pg');

const COMMIT = process.argv.includes('--commit');

const client = new Client({
  host: 'db.amyttoowrroajffqubpd.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'f5fIQC4B8KaqcDH4',
  ssl: { rejectUnauthorized: false }
});

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/__/g, ' ')
    .replace(/[_\-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFolder(storagePath) {
  const parts = storagePath.split('/');
  if (parts[0] === 'unmatched' && parts.length >= 2) return parts[1];
  return parts[0];
}

// Parse a client name into significant tokens (>3 chars), prioritizing last name
function parseClientName(clientName) {
  const norm = normalize(clientName);
  // Remove common suffixes
  const cleaned = norm.replace(/\b(inc|llc|llp|corp|corporation|company|co|association|aao|estate of)\b/g, '').trim();
  return cleaned.split(' ').filter(t => t.length > 3);
}

// Normalize folder name: strip leading Clio numbers, normalize separators
function normFolder(folder) {
  let n = normalize(folder);
  n = n.replace(/^\d+\s+/, ''); // strip leading numbers
  // Remove common suffixes for matching
  const cleaned = n.replace(/\b(inc|llc|llp|corp|corporation|company|co|association|case)\b/g, '').replace(/\s+/g, ' ').trim();
  return cleaned;
}

function getTokens(s) {
  return s.split(' ').filter(t => t.length > 3);
}

(async () => {
  await client.connect();
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}\n`);

  const { rows: cases } = await client.query('SELECT id, ref, client_name FROM cases');
  console.log(`Cases: ${cases.length}`);

  // Build case lookup structures
  const casesByNorm = new Map(); // full normalized name → case
  const casesByTokenSet = []; // { tokens, case } for token matching

  for (const c of cases) {
    const norm = normalize(c.client_name);
    casesByNorm.set(norm, c);
    
    // Also store reversed "Last, First" as "First Last"
    if (c.client_name.includes(',')) {
      const parts = c.client_name.split(',').map(s => s.trim());
      const reversed = normalize(parts.slice(1).join(' ') + ' ' + parts[0]);
      casesByNorm.set(reversed, c);
    }
    
    const tokens = parseClientName(c.client_name);
    if (tokens.length > 0) {
      casesByTokenSet.push({ tokens, norm, case: c });
    }
  }

  // Fetch distinct folders
  const { rows: folderRows } = await client.query(`
    SELECT DISTINCT split_part(storage_path, '/', 2) as folder, count(*)::int as cnt
    FROM documents WHERE case_id IS NULL AND storage_path LIKE 'unmatched/%'
    GROUP BY folder ORDER BY cnt DESC
  `);
  console.log(`Distinct unlinked folders: ${folderRows.length}\n`);

  const matched = [];
  const unmatched = [];

  for (const { folder, cnt } of folderRows) {
    if (!folder) continue;
    
    const nf = normFolder(folder);
    const nfFull = normalize(folder).replace(/^\d+\s+/, ''); // without suffix removal
    let match = null;
    let strategy = '';

    // Strategy 1: Exact normalized match (full name)
    if (casesByNorm.has(nfFull)) {
      match = casesByNorm.get(nfFull);
      strategy = 'exact';
    }
    if (!match && casesByNorm.has(nf)) {
      match = casesByNorm.get(nf);
      strategy = 'exact-cleaned';
    }

    // Strategy 2: Full name contained in folder or folder contained in full name
    // But require the match to be the FULL case name, not just a first name
    if (!match) {
      for (const [normName, c] of casesByNorm) {
        if (normName.length > 5 && nf.length > 5) {
          if (nf === normName || nfFull === normName) {
            match = c;
            strategy = 'exact-alt';
            break;
          }
        }
      }
    }

    // Strategy 3: ALL significant tokens of case name found in folder name
    // This is the safest fuzzy match - every word in the case name must appear
    if (!match) {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const entry of casesByTokenSet) {
        const caseTokens = entry.tokens;
        const folderTokens = getTokens(nf);
        
        // Every case token must match a folder token exactly
        const allFound = caseTokens.every(ct => 
          folderTokens.some(ft => ft === ct)
        );
        
        if (allFound && caseTokens.length >= 1) {
          // Skip if case has only 1 token and it's a common name (too ambiguous)
          if (caseTokens.length === 1 && caseTokens[0].length <= 5) continue;
          // Require at least 2 matching tokens, OR 1 token that's very distinctive (>6 chars)
          // AND the folder shouldn't have way more tokens (prevents partial name grabs)
          if (caseTokens.length === 1 && folderTokens.length > 2) continue;
          const score = caseTokens.length * 2 + (caseTokens.length === folderTokens.length ? 10 : 0);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entry.case;
          }
        }
      }
      
      if (bestMatch) {
        match = bestMatch;
        strategy = 'all-tokens';
      }
    }

    // Strategy 4: Folder is just a last name that uniquely matches one case
    if (!match) {
      const folderTokens = getTokens(nf);
      if (folderTokens.length === 1) {
        const candidates = casesByTokenSet.filter(e => 
          e.tokens.some(t => t === folderTokens[0])
        );
        if (candidates.length === 1) {
          match = candidates[0].case;
          strategy = 'unique-lastname';
        }
      }
    }

    // Strategy 5: "Name part" after Clio number matches case name
    // For folders like "453 Laurel Rd Holdings LLC"
    if (!match) {
      const withNum = normalize(folder);
      const numMatch = withNum.match(/^(\d+)\s+(.+)/);
      if (numMatch) {
        const namePart = numMatch[2].replace(/\b(inc|llc|llp|corp|corporation|company|co|case)\b/g, '').replace(/\s+/g, ' ').trim();
        const nameTokens = namePart.split(' ').filter(t => t.length > 3);
        
        for (const entry of casesByTokenSet) {
          const allFound = nameTokens.length > 0 && nameTokens.every(nt =>
            entry.tokens.some(ct => ct === nt)
          );
          if (allFound && nameTokens.length >= 1) {
            match = entry.case;
            strategy = 'clio-number-name';
            break;
          }
        }
      }
    }

    if (match) {
      matched.push({ folder, case: match, strategy, docCount: cnt });
    } else {
      unmatched.push({ folder, docCount: cnt });
    }
  }

  const totalMatchedDocs = matched.reduce((s, m) => s + m.docCount, 0);
  const totalUnmatchedDocs = unmatched.reduce((s, m) => s + m.docCount, 0);

  console.log('=== MATCH RESULTS ===');
  console.log(`Matched folders: ${matched.length} (${totalMatchedDocs} docs)`);
  console.log(`Unmatched folders: ${unmatched.length} (${totalUnmatchedDocs} docs)\n`);

  const byStrategy = {};
  for (const m of matched) {
    byStrategy[m.strategy] = (byStrategy[m.strategy] || { folders: 0, docs: 0 });
    byStrategy[m.strategy].folders++;
    byStrategy[m.strategy].docs += m.docCount;
  }
  console.log('By strategy:');
  for (const [s, v] of Object.entries(byStrategy)) {
    console.log(`  ${s}: ${v.folders} folders, ${v.docs} docs`);
  }

  console.log('\n=== ALL MATCHES ===');
  for (const m of matched) {
    console.log(`  [${m.strategy}] "${m.folder}" → "${m.case.client_name}" (${m.case.ref}) — ${m.docCount} docs`);
  }

  console.log(`\n=== UNMATCHED FOLDERS (${unmatched.length}) ===`);
  for (const u of unmatched) {
    console.log(`  "${u.folder}" — ${u.docCount} docs`);
  }

  if (COMMIT && matched.length > 0) {
    console.log('\n=== COMMITTING UPDATES ===');
    let updated = 0;
    for (const m of matched) {
      const res = await client.query(
        `UPDATE documents SET case_id = $1, updated_at = NOW()
         WHERE case_id IS NULL AND storage_path LIKE $2`,
        [m.case.id, `unmatched/${m.folder}/%`]
      );
      updated += res.rowCount;
      process.stdout.write('.');
    }
    console.log(`\nUpdated ${updated} documents.`);
  } else if (!COMMIT) {
    console.log('\n(Dry run — pass --commit to apply changes)');
  }

  await client.end();
})();
