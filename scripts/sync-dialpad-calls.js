#!/usr/bin/env node
/**
 * Sync Dialpad calls to case_calls table in Supabase.
 * 
 * Usage:
 *   node scripts/sync-dialpad-calls.js                  # dry run (default)
 *   node scripts/sync-dialpad-calls.js --commit         # actually write to DB
 *   node scripts/sync-dialpad-calls.js --csv path.csv   # use local CSV instead of API
 *
 * Environment (.env.local):
 *   DIALPAD_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amyttoowrroajffqubpd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const csvIdx = args.indexOf('--csv');
const csvPath = csvIdx !== -1 ? args[csvIdx + 1] : null;

// Phone normalization: strip to +1XXXXXXXXXX
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  if (raw.startsWith('+') && digits.length === 11) return '+' + digits;
  return raw; // return as-is if weird
}

// Parse CSV (handles quoted fields with commas/newlines)
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len || text[i] === '\n' || text[i] === '\r') return '';
    if (text[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') { field += '"'; i += 2; }
          else { i++; break; }
        } else { field += text[i]; i++; }
      }
      return field;
    }
    let field = '';
    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      field += text[i]; i++;
    }
    return field;
  }

  function parseLine() {
    const fields = [];
    while (i < len && text[i] !== '\n' && text[i] !== '\r') {
      fields.push(parseField());
      if (i < len && text[i] === ',') i++;
    }
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    return fields;
  }

  const headers = parseLine();
  while (i < len) {
    if (text[i] === '\n' || text[i] === '\r') { i++; continue; }
    const fields = parseLine();
    if (fields.length === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (fields[idx] || '').trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}

// Compute duration in seconds from date_started/date_ended
function computeDuration(started, ended) {
  if (!started || !ended) return null;
  const ms = new Date(ended) - new Date(started);
  return ms > 0 ? Math.round(ms / 1000) : null;
}

function toTimestamp(val) {
  if (!val || val === '') return null;
  return val;
}

function toInt(val) {
  if (!val || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toFloat(val) {
  if (!val || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toBool(val) {
  return val === 'true' || val === 'True' || val === '1';
}

// Fetch CSV from Dialpad Stats API
async function fetchFromDialpad() {
  if (!DIALPAD_API_KEY) throw new Error('DIALPAD_API_KEY not set in .env.local');

  const baseUrl = 'https://dialpad.com/api/v2';
  const headers = { 'Authorization': `Bearer ${DIALPAD_API_KEY}`, 'Content-Type': 'application/json' };

  // Initiate export (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  console.log('Initiating Dialpad stats export...');
  const initRes = await fetch(`${baseUrl}/stats`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      stat_type: 'calls',
      days_ago_start: 30,
      days_ago_end: 0,
      export_type: 'records',
    }),
  });

  if (!initRes.ok) throw new Error(`Dialpad POST /stats failed: ${initRes.status} ${await initRes.text()}`);
  const { request_id } = await initRes.json();
  console.log(`Export request ID: ${request_id}`);

  // Poll until ready
  let csvUrl = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(`${baseUrl}/stats/${request_id}`, { headers });
    if (!pollRes.ok) throw new Error(`Dialpad GET /stats/${request_id} failed: ${pollRes.status}`);
    const status = await pollRes.json();
    if (status.status === 'complete' && status.download_url) {
      csvUrl = status.download_url;
      break;
    }
    process.stdout.write('.');
  }
  if (!csvUrl) throw new Error('Dialpad export timed out after 5 minutes');

  console.log('\nDownloading CSV...');
  const csvRes = await fetch(csvUrl);
  return await csvRes.text();
}

async function main() {
  console.log(`Mode: ${commit ? 'COMMIT' : 'DRY RUN'}`);

  // Get CSV data
  let csvText;
  if (csvPath) {
    console.log(`Reading local CSV: ${csvPath}`);
    csvText = fs.readFileSync(path.resolve(csvPath), 'utf8');
  } else {
    csvText = await fetchFromDialpad();
  }

  const { rows } = parseCSV(csvText);
  console.log(`Parsed ${rows.length} call records`);

  // Get cases from Supabase for phone matching
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY || 'dummy');
  let casesMap = new Map(); // normalized phone -> case id

  if (SUPABASE_KEY) {
    const { data: cases, error } = await supabase.from('cases').select('id, client_phone');
    if (error) { console.error('Error fetching cases:', error.message); }
    else {
      for (const c of cases) {
        const norm = normalizePhone(c.client_phone);
        if (norm) casesMap.set(norm, c.id);
      }
      console.log(`Loaded ${cases.length} cases, ${casesMap.size} with phone numbers`);
    }
  } else {
    console.log('No SUPABASE_SERVICE_ROLE_KEY — skipping case matching (dry run only)');
  }

  // Map calls
  let matched = 0, unmatched = 0, internal = 0;
  const upserts = [];

  for (const row of rows) {
    // Skip internal calls
    if (row.is_internal === 'true' || row.is_internal === 'True') { internal++; continue; }

    const extPhone = normalizePhone(row.external_number);
    const caseId = extPhone ? casesMap.get(extPhone) : null;

    if (caseId) matched++;
    else unmatched++;

    const duration = computeDuration(row.date_started, row.date_ended);
    const talkDuration = toFloat(row.talk_duration);

    upserts.push({
      call_id: row.call_id,
      case_id: caseId || null,
      direction: row.direction || null,
      category: row.category || null,
      external_number: row.external_number || null,
      internal_number: row.internal_number || null,
      date_started: toTimestamp(row.date_started),
      date_connected: toTimestamp(row.date_connected),
      date_ended: toTimestamp(row.date_ended),
      duration_seconds: duration,
      talk_duration_seconds: talkDuration ? Math.round(talkDuration) : null,
      caller_name: row.name || null,
      caller_email: row.email || null,
      was_recorded: toBool(row.was_recorded),
      voicemail: toBool(row.voicemail),
      target_type: row.target_type || null,
      target_name: row.name || null,
      ai_talk_pct: toFloat(row.percent_ai_talk_time),
      ai_listen_pct: toFloat(row.percent_ai_listen_time),
      ai_silent_pct: toFloat(row.percent_ai_silent_time),
      notes: row.categories || null,
    });
  }

  console.log('\n--- Stats ---');
  console.log(`Total records:    ${rows.length}`);
  console.log(`Internal (skip):  ${internal}`);
  console.log(`Matched to case:  ${matched}`);
  console.log(`Unmatched:        ${unmatched}`);
  console.log(`Upserts ready:    ${upserts.length}`);

  if (!commit) {
    console.log('\nDry run complete. Use --commit to write to database.');
    // Show sample
    const withCase = upserts.filter(u => u.case_id);
    if (withCase.length > 0) {
      console.log('\nSample matched call:');
      console.log(JSON.stringify(withCase[0], null, 2));
    }
    return;
  }

  if (!SUPABASE_KEY) {
    console.error('Cannot commit without SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Upsert in batches of 500
  const batchSize = 500;
  let written = 0;
  for (let i = 0; i < upserts.length; i += batchSize) {
    const batch = upserts.slice(i, i + batchSize);
    const { error } = await supabase
      .from('case_calls')
      .upsert(batch, { onConflict: 'call_id' });
    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize)} error:`, error.message);
    } else {
      written += batch.length;
    }
  }

  console.log(`\nWritten ${written} records to case_calls.`);
}

main().catch(err => { console.error(err); process.exit(1); });
