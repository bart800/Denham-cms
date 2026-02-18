// Populate contacts table from existing adjuster data on cases
// and Filevine Person IDs from claim_details
// Dry run by default, pass --commit to write

const { Client } = require('pg');

const COMMIT = process.argv.includes('--commit');

async function run() {
  const c = new Client({
    host: 'db.amyttoowrroajffqubpd.supabase.co', port: 5432,
    database: 'postgres', user: 'postgres', password: 'f5fIQC4B8KaqcDH4',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log(`Connected! Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);

  // 1. Extract unique adjusters from cases table
  const { rows: adjusters } = await c.query(`
    SELECT DISTINCT adjuster_name, adjuster_phone, adjuster_email, insurer
    FROM cases 
    WHERE adjuster_name IS NOT NULL AND adjuster_name != ''
  `);
  console.log(`\nFound ${adjusters.length} unique adjuster entries on cases`);

  // Deduplicate by name (normalize)
  const contactMap = new Map(); // key: normalized name -> contact data
  
  for (const a of adjusters) {
    const name = a.adjuster_name.trim();
    const key = name.toLowerCase();
    if (!contactMap.has(key)) {
      // Parse first/last name
      const parts = name.split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      contactMap.set(key, {
        first_name: firstName,
        last_name: lastName,
        company: a.insurer || null,
        phone: a.adjuster_phone || null,
        email: a.adjuster_email || null,
        tags: ['adjuster'],
        type: 'person'
      });
    } else {
      // Merge: fill in missing fields
      const existing = contactMap.get(key);
      if (!existing.phone && a.adjuster_phone) existing.phone = a.adjuster_phone;
      if (!existing.email && a.adjuster_email) existing.email = a.adjuster_email;
      if (!existing.company && a.insurer) existing.company = a.insurer;
    }
  }

  console.log(`Deduplicated to ${contactMap.size} unique contacts`);

  // 2. Also extract insurer companies as company contacts
  const { rows: insurers } = await c.query(`
    SELECT DISTINCT insurer FROM cases 
    WHERE insurer IS NOT NULL AND insurer != ''
  `);
  console.log(`Found ${insurers.length} unique insurers`);

  for (const ins of insurers) {
    const key = `company:${ins.insurer.toLowerCase()}`;
    if (!contactMap.has(key)) {
      contactMap.set(key, {
        first_name: null,
        last_name: null,
        company: ins.insurer,
        phone: null,
        email: null,
        tags: ['insurer'],
        type: 'company'
      });
    }
  }

  console.log(`Total contacts to create: ${contactMap.size}`);

  if (!COMMIT) {
    console.log('\nDRY RUN - showing first 10:');
    let i = 0;
    for (const [key, contact] of contactMap) {
      if (i++ >= 10) break;
      console.log(`  ${contact.type === 'company' ? '🏢' : '👤'} ${contact.first_name || ''} ${contact.last_name || ''} ${contact.company ? `(${contact.company})` : ''} [${contact.tags.join(',')}]`);
    }
    console.log('\nRun with --commit to write to database');
    await c.end();
    return;
  }

  // 3. Insert contacts
  let created = 0;
  let errors = 0;
  const contactIds = new Map(); // key -> uuid

  for (const [key, contact] of contactMap) {
    try {
      const { rows } = await c.query(`
        INSERT INTO contacts (type, first_name, last_name, company, phone, email, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [contact.type, contact.first_name, contact.last_name, contact.company, contact.phone, contact.email, contact.tags]);
      contactIds.set(key, rows[0].id);
      created++;
    } catch (e) {
      console.error(`  ❌ ${key}: ${e.message}`);
      errors++;
    }
  }
  console.log(`\nCreated ${created} contacts (${errors} errors)`);

  // 4. Link adjuster contacts to their cases
  let linked = 0;
  let linkErrors = 0;

  const { rows: casesWithAdj } = await c.query(`
    SELECT id, adjuster_name, insurer FROM cases 
    WHERE adjuster_name IS NOT NULL AND adjuster_name != ''
  `);

  for (const cas of casesWithAdj) {
    const key = cas.adjuster_name.trim().toLowerCase();
    const contactId = contactIds.get(key);
    if (!contactId) continue;

    try {
      await c.query(`
        INSERT INTO case_contacts (case_id, contact_id, role)
        VALUES ($1, $2, 'adjuster')
        ON CONFLICT (case_id, contact_id, role) DO NOTHING
      `, [cas.id, contactId]);
      linked++;
    } catch (e) {
      linkErrors++;
    }

    // Also link the insurer company
    const insurerKey = `company:${(cas.insurer || '').toLowerCase()}`;
    const insurerContactId = contactIds.get(insurerKey);
    if (insurerContactId) {
      try {
        await c.query(`
          INSERT INTO case_contacts (case_id, contact_id, role)
          VALUES ($1, $2, 'defendant')
          ON CONFLICT (case_id, contact_id, role) DO NOTHING
        `, [cas.id, insurerContactId]);
        linked++;
      } catch (e) {
        linkErrors++;
      }
    }
  }

  console.log(`Linked ${linked} case↔contact relationships (${linkErrors} errors)`);

  // Summary
  const { rows: [{ n: totalContacts }] } = await c.query("SELECT count(*)::int as n FROM contacts");
  const { rows: [{ n: totalLinks }] } = await c.query("SELECT count(*)::int as n FROM case_contacts");
  console.log(`\n📊 Final: ${totalContacts} contacts, ${totalLinks} case links`);

  await c.end();
  console.log('Done!');
}

run().catch(e => { console.error(e.message); process.exit(1); });
