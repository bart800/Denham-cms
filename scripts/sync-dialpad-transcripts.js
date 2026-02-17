#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.DIALPAD_API_KEY;
const COMMIT = process.argv.includes('--commit');
const DELAY_MS = 220; // ~4.5 req/sec, conservative under 5

async function fetchTranscript(callId) {
  const res = await fetch(`https://dialpad.com/api/v2/transcripts/${callId}?apikey=${API_KEY}`);
  if (!res.ok) return null;
  return res.json();
}

function parseTranscript(data) {
  if (!data || !data.lines) return null;
  const lines = data.lines.filter(l => l.type === 'transcript');
  const moments = data.lines.filter(l => l.type === 'moment');

  const transcript = lines.map(l => `${l.name || 'Unknown'}: ${l.content}`).join('\n');
  const aiMoments = moments.map(l => ({ name: l.name, content: l.content, time: l.time }));

  const summaryParts = moments
    .filter(l => ['whole_call_summary', 'call_purpose'].includes(l.name))
    .map(l => l.content);
  const aiSummary = summaryParts.length ? summaryParts.join(' — ') : null;

  return { transcript: transcript || null, aiSummary, aiMoments: aiMoments.length ? aiMoments : null };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN (use --commit to write)'}`);

  // Fetch all call_ids where transcript is null
  const { data: rows, error } = await supabase
    .from('case_calls')
    .select('id, call_id')
    .is('transcript', null)
    .not('call_id', 'is', null);

  if (error) { console.error('Query error:', error.message); process.exit(1); }
  console.log(`Found ${rows.length} calls without transcripts`);

  let found = 0, notFound = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const { id, call_id } = rows[i];
    if ((i + 1) % 50 === 0) console.log(`Progress: ${i + 1}/${rows.length} (found: ${found}, empty: ${notFound}, errors: ${errors})`);

    try {
      const data = await fetchTranscript(call_id);
      if (!data || !data.lines || !data.lines.length) { notFound++; continue; }

      const parsed = parseTranscript(data);
      if (!parsed || !parsed.transcript) { notFound++; continue; }

      found++;
      if (COMMIT) {
        const { error: upErr } = await supabase
          .from('case_calls')
          .update({
            transcript: parsed.transcript,
            ai_summary: parsed.aiSummary,
            ai_moments: parsed.aiMoments,
          })
          .eq('id', id);
        if (upErr) { console.error(`Update error for ${call_id}:`, upErr.message); errors++; }
      } else {
        console.log(`  [DRY] ${call_id}: ${parsed.transcript.length} chars, summary: ${parsed.aiSummary ? 'yes' : 'no'}, moments: ${parsed.aiMoments?.length || 0}`);
      }
    } catch (e) {
      errors++;
      if (errors < 5) console.error(`Error for ${call_id}:`, e.message);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Found: ${found}, No transcript: ${notFound}, Errors: ${errors}, Total: ${rows.length}`);
}

main();
