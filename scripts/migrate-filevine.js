#!/usr/bin/env node
/**
 * Migrate Filevine Project Hub data into Supabase CMS.
 * - Filters to Property Casualty only (skips PI)
 * - Maps Filevine phases to CMS statuses
 * - Creates cases with real names, phases, attorneys
 * - Merges extra detail from filevine-extracted.json where available
 */

const { createClient } = require('@supabase/supabase-js');
const hubData = require('../data/filevine-projects.json');
const extractedData = require('../data/filevine-extracted.json');

const SUPABASE_URL = 'https://amyttoowrroajffqubpd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Build a lookup from extracted data for extra fields
const extractedLookup = {};
for (const c of extractedData.cases) {
  // Match by projectId or name
  if (c.projectId) extractedLookup[String(c.projectId)] = c;
  extractedLookup[c.name.toLowerCase()] = c;
}

// Phase → Status mapping
function mapPhaseToStatus(phase) {
  const map = {
    'Pre-Suit': 'Presuit Demand',
    'Litigation': 'Litigation - Filed',
    'Settlement': 'Settled',
    'Appraisal': 'Appraisal',
    'Referred': 'Intake',
    'Settlement Decision': 'Settled',
    'Case Monitoring': 'Closed',
    'Demand and Negotiation': 'Presuit Negotiation',
    'Case Intake and Investigation': 'Intake',
  };
  return map[phase] || 'Intake';
}

// Parse case name to extract insurer
function extractInsurer(name) {
  const match = name.match(/v\.\s*(.+?)(?:\s+and\s+|$)/i);
  if (match) return match[1].trim();
  // Common patterns
  const insurers = ['State Farm', 'Allstate', 'USAA', 'Nationwide', 'Erie', 'Progressive',
    'Liberty Mutual', 'Shelter', 'Homesite', 'KFB', 'Kentucky Farm Bureau', 'Farm Bureau',
    'Farmers', 'Foremost', 'Travelers', 'Auto-Owners', 'Auto Owners', 'Grange',
    'Encova', 'Westfield', 'American Reliable', 'Safeco', 'Assurant'];
  for (const ins of insurers) {
    if (name.toLowerCase().includes(ins.toLowerCase())) return ins;
  }
  return 'TBD';
}

// Extract client name from case name (before "v.")
function extractClientName(name) {
  const parts = name.split(/\s+v\.?\s+/i);
  return parts[0].trim();
}

// Parse "May 25, 2025" format
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// Guess jurisdiction from insurer/case name
function guessJurisdiction(name, insurer) {
  const lower = (name + ' ' + insurer).toLowerCase();
  if (lower.includes('tennessee') || lower.includes(' tn')) return 'TN';
  if (lower.includes('montana') || lower.includes(' mt')) return 'MT';
  if (lower.includes('north carolina') || lower.includes(' nc')) return 'NC';
  if (lower.includes('texas') || lower.includes(' tx')) return 'TX';
  if (lower.includes('new jersey') || lower.includes(' nj')) return 'NY'; // closest we have
  return 'KY'; // default
}

async function main() {
  console.log('🔄 Starting Filevine → CMS migration...\n');
  
  // Get team members
  const { data: team, error: teamErr } = await supabase.from('team_members').select('*');
  if (teamErr) throw teamErr;
  console.log(`👥 Found ${team.length} team members`);
  
  // Build attorney lookup
  const attorneyLookup = {};
  for (const t of team) {
    attorneyLookup[t.name.toLowerCase()] = t.id;
    // Also match partial names
    const firstName = t.name.split(' ')[0].toLowerCase();
    attorneyLookup[firstName] = t.id;
  }
  
  // Filter to Property Casualty
  const pcCases = hubData.projects.filter(p => p.type === 'Property Casualty');
  console.log(`📂 Processing ${pcCases.length} Property Casualty cases (skipping ${hubData.total - pcCases.length} PI)\n`);
  
  // Delete existing seed cases
  console.log('🗑️  Clearing seed data...');
  // First delete dependent records
  for (const table of ['case_notes', 'tasks', 'discovery_requests', 'documents', 'negotiations', 'expenses', 'insurance_details']) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.log(`  ⚠️  ${table}: ${error.message}`);
    else console.log(`  ✓ Cleared ${table}`);
  }
  const { error: casesDelErr } = await supabase.from('cases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (casesDelErr) console.log(`  ⚠️  cases: ${casesDelErr.message}`);
  else console.log('  ✓ Cleared cases');
  
  // Default support person (first paralegal/case manager)
  const defaultSupport = team.find(t => t.role === 'Paralegal' || t.role === 'Case Manager') || team[0];
  const defaultAttorney = team.find(t => t.name === 'Bart Denham') || team[0];
  
  // Insert cases in batches
  let inserted = 0;
  let failed = 0;
  const batchSize = 50;
  
  for (let i = 0; i < pcCases.length; i += batchSize) {
    const batch = pcCases.slice(i, i + batchSize);
    const rows = batch.map((p, idx) => {
      const caseNum = i + idx + 1;
      const clientName = extractClientName(p.name);
      const insurer = extractInsurer(p.name);
      const status = mapPhaseToStatus(p.phase);
      const jurisdiction = guessJurisdiction(p.name, insurer);
      const dateOpened = parseDate(p.created) || '2025-05-25';
      
      // Try to find attorney UUID
      const primaryLower = p.primary.toLowerCase();
      let attorneyId = attorneyLookup[primaryLower];
      if (!attorneyId) {
        // Try first name
        const firstName = primaryLower.split(' ')[0];
        attorneyId = attorneyLookup[firstName];
      }
      if (!attorneyId) attorneyId = defaultAttorney.id;
      
      // Get extra details from extracted data
      const extra = extractedLookup[p.id] || extractedLookup[p.name.toLowerCase()] || {};
      const details = extra.details || {};
      
      // Generate a ref number
      const ref = `DC-${String(caseNum).padStart(4, '0')}`;
      
      // Date of loss: from extracted details or estimate from created date
      const dateOfLoss = details.dateOfLoss ? details.dateOfLoss : 
        (dateOpened ? new Date(new Date(dateOpened).getTime() - 60*86400000).toISOString().split('T')[0] : '2025-01-01');
      
      // SOL: from extracted details or estimate 2 years from loss
      const sol = details.sol ? details.sol :
        (dateOfLoss ? new Date(new Date(dateOfLoss).getTime() + 730*86400000).toISOString().split('T')[0] : '2027-01-01');
      
      return {
        ref,
        client_name: clientName,
        type: 'First-Party Property',
        status,
        jurisdiction,
        attorney_id: attorneyId,
        support_id: defaultSupport.id,
        date_of_loss: dateOfLoss,
        date_opened: dateOpened,
        statute_of_limitations: sol,
        insurer: insurer,
        claim_number: details.claimNumber || null,
        policy_number: details.policyNumber || null,
        total_recovery: details.demandAmount || 0,
      };
    });
    
    const { data, error } = await supabase.from('cases').insert(rows).select('id, ref');
    if (error) {
      console.log(`❌ Batch ${Math.floor(i/batchSize)+1} failed: ${error.message}`);
      // Try one by one
      for (const row of rows) {
        const { error: singleErr } = await supabase.from('cases').insert(row);
        if (singleErr) {
          console.log(`  ❌ ${row.client_name}: ${singleErr.message}`);
          failed++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += data.length;
      console.log(`✅ Batch ${Math.floor(i/batchSize)+1}: ${data.length} cases inserted`);
    }
  }
  
  console.log(`\n🎉 Migration complete!`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total PC cases: ${pcCases.length}`);
  
  // Verify
  const { count } = await supabase.from('cases').select('*', { count: 'exact', head: true });
  console.log(`   🔢 Cases in database: ${count}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
