const { Client } = require('pg');
const c = new Client({host:'db.amyttoowrroajffqubpd.supabase.co',port:5432,user:'postgres',password:'f5fIQC4B8KaqcDH4',database:'postgres',ssl:{rejectUnauthorized:false}});

const DC0003 = '745ca916-0f88-4b6c-b994-49ff2cf106c8';

(async()=>{
  await c.connect();
  
  // 1. Load all cases (excluding DC-0003)
  const casesRes = await c.query("SELECT id, ref, client_name, client_email, insurer, adjuster_email FROM cases WHERE id != $1", [DC0003]);
  const cases = casesRes.rows;
  console.log(`Loaded ${cases.length} cases (excluding DC-0003)`);

  // 2. Load ALL DC-0003 emails
  const emailsRes = await c.query("SELECT id, subject, from_address, to_address, cc_address FROM case_emails WHERE case_id = $1", [DC0003]);
  const emails = emailsRes.rows;
  console.log(`Loaded ${emails.length} DC-0003 emails to process`);

  // 3. Build matching indexes
  // Index by client email (lowercase)
  const emailToCase = new Map();
  // Index by adjuster email
  const adjusterToCase = new Map();
  // Case ref patterns
  const refPatterns = []; // {regex, caseId}
  // Client name patterns (last names, full names)
  const namePatterns = []; // {regex, caseId, ref}
  // Insurer patterns
  const insurerToCase = new Map(); // insurer name -> [{caseId, ref}]

  for (const cs of cases) {
    // Client email
    if (cs.client_email && !cs.client_email.includes('filevineapp.com') && !cs.client_email.includes('denham.law') && !cs.client_email.includes('statefarmfireclaims')) {
      const email = cs.client_email.toLowerCase().trim();
      if (!emailToCase.has(email)) emailToCase.set(email, []);
      emailToCase.get(email).push({caseId: cs.id, ref: cs.ref});
    }

    // Adjuster email
    if (cs.adjuster_email) {
      const email = cs.adjuster_email.toLowerCase().trim();
      if (!adjusterToCase.has(email)) adjusterToCase.set(email, []);
      adjusterToCase.get(email).push({caseId: cs.id, ref: cs.ref});
    }

    // Case ref pattern (DC-XXXX in subject)
    refPatterns.push({regex: new RegExp(cs.ref.replace('-', '[\\s-]?'), 'i'), caseId: cs.id, ref: cs.ref});

    // Client name patterns - extract meaningful last names
    const name = cs.client_name || '';
    // Try last name (first word if "LastName, First" format, or last word otherwise)
    let lastName = '';
    if (name.includes(',')) {
      lastName = name.split(',')[0].trim();
    } else if (name.includes(' ')) {
      const parts = name.split(/\s+/);
      // Use last word as potential last name, skip common words
      lastName = parts[parts.length - 1];
      // Also try first word for "FirstName LastName" patterns
    }
    
    // Skip generic/short names that would false-match
    const skipNames = ['LLC', 'Inc', 'Inc.', 'TN', 'KY', 'Jr.', 'Sr.', 'II', 'III', 'The', 'of', 'and', 'Properties', 'Roofing', 'Church', 'Estate', 'Association', 'Company', 'Insurance'];
    
    if (lastName && lastName.length > 2 && !skipNames.includes(lastName)) {
      namePatterns.push({name: lastName, regex: new RegExp('\\b' + lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), caseId: cs.id, ref: cs.ref});
    }

    // Full client name match for unique names
    if (name.length > 5) {
      namePatterns.push({name: name, regex: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i'), caseId: cs.id, ref: cs.ref, fullName: true});
    }
  }

  console.log(`Built indexes: ${emailToCase.size} client emails, ${adjusterToCase.size} adjuster emails, ${refPatterns.length} ref patterns, ${namePatterns.length} name patterns`);

  // 4. Define noise patterns for deletion
  const noisePatterns = [
    /pncalerts@pnc\.com/i,
    /ambetter/i,
    /noreply@github\.com/i,
    /noreply@dialpad\.com/i,
    /message@adobe\.com/i,
    /quarantine@messaging\.microsoft\.com/i,
    /auto-reply@usps\.gov/i,
    /notifications@clio\.com/i,
    /noreply@m\.fl\.membercentral\.org/i,
    /@email\.ambetterhealth\.com/i,
    /microsoft.*quarantine/i,
    /Your account was overdrawn/i,
    /Your payment failed/i,
    /payment.*received|payment.*confirmation/i,
    /noreply@.*\.vercel\.app/i,
    /noreply@supabase\.io/i,
    /noreply@vercel\.com/i,
    /newsletter/i,
    /unsubscribe.*click/i,
    /donotreply/i,
    /no-reply@/i,
    /Kentucky Derby\. Lexington\. Grayphite/i,
    /Long Work\. Quiet Responsibility/i,
    /Phishing:/i,
    /New API Key generated/i,
    /third-party GitHub Application/i,
    /LinkedIn/i,
    /grayphite\.ltd/i,
    /deegeerehab\.com/i,
  ];

  // Denham law staff emails (not noise, but not case-specific without more context)
  const denhamStaff = ['bart@denham.law','eliza@denham.law','kristen@denham.law','olivia@denham.law','kami@denham.law','joey@denham.law','shelby@denham.law','christopher@denham.law','martin@denham.law','nick@denham.law','skrt@denham.law','caeden@denham.law'];

  // 5. Process each email
  const relinked = []; // {emailId, caseId, ref, matchedBy}
  const toDelete = []; // {emailId, reason}
  const unmatched = []; // {emailId, subject, from, to}

  for (const email of emails) {
    const subj = (email.subject || '').toLowerCase();
    const from = (email.from_address || '').toLowerCase();
    const to = (email.to_address || '').toLowerCase();
    const cc = (email.cc_address || '').toLowerCase();
    const allAddresses = from + ' ' + to + ' ' + cc;
    const allText = subj + ' ' + from + ' ' + to + ' ' + cc;

    let matched = false;

    // Check noise first
    for (const np of noisePatterns) {
      if (np.test(from) || np.test(subj) || np.test(to)) {
        toDelete.push({emailId: email.id, reason: 'noise: ' + np.source.substring(0, 30)});
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Match 1: Case ref in subject (DC-XXXX)
    const refMatch = subj.match(/dc[\s-]?(\d{4})/i);
    if (refMatch) {
      const refNum = refMatch[1];
      const refStr = 'DC-' + refNum;
      const found = refPatterns.find(rp => rp.ref === refStr);
      if (found) {
        relinked.push({emailId: email.id, caseId: found.caseId, ref: found.ref, matchedBy: 'case_ref'});
        continue;
      }
    }

    // Match 2: Client email in from/to/cc
    let emailMatch = null;
    for (const [clientEmail, caseList] of emailToCase) {
      if (allAddresses.includes(clientEmail)) {
        if (caseList.length === 1) {
          emailMatch = caseList[0];
          break;
        }
        // Multiple cases for same email - try to disambiguate by subject
        // For now, skip (will try other matching)
      }
    }
    if (emailMatch) {
      relinked.push({emailId: email.id, caseId: emailMatch.caseId, ref: emailMatch.ref, matchedBy: 'client_email'});
      continue;
    }

    // Match 2b: Adjuster email
    for (const [adjEmail, caseList] of adjusterToCase) {
      if (allAddresses.includes(adjEmail)) {
        if (caseList.length === 1) {
          emailMatch = caseList[0];
          break;
        }
      }
    }
    if (emailMatch) {
      relinked.push({emailId: email.id, caseId: emailMatch.caseId, ref: emailMatch.ref, matchedBy: 'adjuster_email'});
      continue;
    }

    // Match 3: Client name in subject (full name first, then last name)
    let nameMatch = null;
    // Try full names first (more specific)
    for (const np of namePatterns) {
      if (np.fullName && np.regex.test(subj)) {
        nameMatch = np;
        break;
      }
    }
    // Then try last names
    if (!nameMatch) {
      const lastNameMatches = namePatterns.filter(np => !np.fullName && np.regex.test(subj));
      if (lastNameMatches.length === 1) {
        nameMatch = lastNameMatches[0];
      }
      // If multiple last name matches, skip (ambiguous)
    }
    if (nameMatch) {
      relinked.push({emailId: email.id, caseId: nameMatch.caseId, ref: nameMatch.ref, matchedBy: 'client_name: ' + nameMatch.name});
      continue;
    }

    // No match found
    unmatched.push({emailId: email.id, subject: email.subject, from: email.from_address, to: email.to_address});
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Relinked: ${relinked.length}`);
  console.log(`To delete (noise): ${toDelete.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log(`Total: ${relinked.length + toDelete.length + unmatched.length}`);

  // Show relink breakdown by match type
  const byType = {};
  for (const r of relinked) {
    const type = r.matchedBy.split(':')[0].trim();
    byType[type] = (byType[type] || 0) + 1;
  }
  console.log(`\nRelink breakdown:`, byType);

  // Show sample unmatched
  console.log(`\nSample unmatched (first 50):`);
  unmatched.slice(0, 50).forEach(u => console.log(`  ${u.subject} | from: ${u.from} | to: ${u.to}`));

  // Show relink targets
  console.log(`\nRelinked by case (first 30):`);
  const byCase = {};
  for (const r of relinked) { byCase[r.ref] = (byCase[r.ref] || 0) + 1; }
  Object.entries(byCase).sort((a,b) => b[1]-a[1]).slice(0,30).forEach(([ref, cnt]) => console.log(`  ${ref}: ${cnt}`));

  // DRY RUN - set to false to execute
  const DRY_RUN = false;

  if (!DRY_RUN) {
    console.log(`\n=== EXECUTING UPDATES ===`);
    
    let relinkCount = 0;
    for (const r of relinked) {
      await c.query("UPDATE case_emails SET case_id = $1, matched_by = $2 WHERE id = $3", [r.caseId, r.matchedBy, r.emailId]);
      relinkCount++;
    }
    console.log(`Relinked ${relinkCount} emails`);

    // Delete noise + unmatched
    const allDeleteIds = [...toDelete.map(d => d.emailId), ...unmatched.map(u => u.emailId)];
    for (let i = 0; i < allDeleteIds.length; i += 100) {
      const chunk = allDeleteIds.slice(i, i + 100);
      const placeholders = chunk.map((_, idx) => '$' + (idx + 1)).join(',');
      await c.query(`DELETE FROM case_emails WHERE id IN (${placeholders})`, chunk);
    }
    console.log(`Deleted ${allDeleteIds.length} emails (${toDelete.length} noise + ${unmatched.length} unmatched)`);

    const finalCount = await c.query("SELECT count(*) FROM case_emails");
    const dc0003Count = await c.query("SELECT count(*) FROM case_emails WHERE case_id = $1", [DC0003]);
    const caseCount = await c.query("SELECT count(DISTINCT case_id) FROM case_emails");
    console.log(`\n=== FINAL STATE ===`);
    console.log(`Total emails remaining: ${finalCount.rows[0].count}`);
    console.log(`DC-0003 emails remaining: ${dc0003Count.rows[0].count}`);
    console.log(`Cases with emails: ${caseCount.rows[0].count}`);
  } else {
    console.log(`\n=== DRY RUN - no changes made ===`);
  }

  await c.end();
})();
