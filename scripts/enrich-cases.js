// Enrich existing Supabase cases with detailed data extracted from LOIS AI sidebar
// READ-ONLY from Filevine — only WRITES to our Supabase

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://amyttoowrroajffqubpd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Load extracted details
  const details = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'lois-extracted-details.json'), 'utf8'));
  
  // Get all cases from Supabase
  const { data: cases, error } = await supabase.from('cases').select('*');
  if (error) { console.error('Failed to fetch cases:', error); return; }
  
  console.log(`Found ${cases.length} cases in Supabase`);
  console.log(`Found ${details.cases.length} enrichment records from LOIS`);
  
  let updated = 0;
  let matched = 0;
  
  for (const detail of details.cases) {
    // Match by case name (fuzzy - check if detail name is contained in case ref/client_name)
    const match = cases.find(c => {
      const cName = (c.ref + ' ' + c.client_name).toLowerCase();
      const dName = detail.name.toLowerCase();
      // Try exact ref match first
      if (c.ref.toLowerCase() === dName) return true;
      // Try partial match
      const parts = dName.split(' v. ');
      if (parts.length === 2) {
        return cName.includes(parts[0].toLowerCase().trim());
      }
      return cName.includes(dName.split(',')[0].toLowerCase().trim());
    });
    
    if (!match) {
      console.log(`  No match for: ${detail.name}`);
      continue;
    }
    
    matched++;
    
    // Build update object
    const updates = {};
    
    if (detail.claimNumber && !match.claim_number) updates.claim_number = detail.claimNumber;
    if (detail.policyNumber && !match.policy_number) updates.policy_number = detail.policyNumber;
    if (detail.clientPhone && !match.client_phone) updates.client_phone = detail.clientPhone;
    if (detail.clientEmail && !match.client_email) updates.client_email = detail.clientEmail;
    if (detail.settlementAmount && match.total_recovery === 0) updates.total_recovery = detail.settlementAmount;
    if (detail.attorneyFee && match.attorney_fees === 0) updates.attorney_fees = detail.attorneyFee;
    
    // Update date_of_loss if we have a better one
    if (detail.dateOfLoss) {
      const parts = detail.dateOfLoss.split('/');
      if (parts.length === 3) {
        const dol = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
        if (dol !== match.date_of_loss) updates.date_of_loss = dol;
      }
    }
    
    // Update SOL if we have it
    if (detail.solDate && detail.solDate !== match.statute_of_limitations) {
      updates.statute_of_limitations = detail.solDate;
    }
    
    if (Object.keys(updates).length === 0) {
      console.log(`  ${detail.name} → matched "${match.ref}" but no new data`);
      continue;
    }
    
    updates.updated_at = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', match.id);
    
    if (updateError) {
      console.log(`  ERROR updating ${match.ref}: ${updateError.message}`);
    } else {
      updated++;
      console.log(`  ✓ ${match.ref} updated: ${Object.keys(updates).filter(k=>k!=='updated_at').join(', ')}`);
    }
  }
  
  console.log(`\nDone: ${matched} matched, ${updated} updated out of ${details.cases.length} records`);
}

main().catch(console.error);
