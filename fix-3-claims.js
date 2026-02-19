const fs = require('fs');
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA';
const H = { 'apikey': SVC, 'Authorization': 'Bearer ' + SVC, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const BASE = 'https://amyttoowrroajffqubpd.supabase.co/rest/v1';

function pd(d) { if (!d) return null; const m = d.match(/^(\d+)\/(\d+)\/(\d+)$/); return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : null; }

const scraped = JSON.parse(fs.readFileSync('data/filevine-scraped-v1.json'));
const names = ['Hunt, Travis v Travelers Personal Insurance Company', 'Jesus Mejia v. Progressive', 'Love, Taylor v. State Farm'];

async function main() {
  const cases = await (await fetch(`${BASE}/cases?select=id,client_name&limit=500`, { headers: H })).json();
  for (const pn of names) {
    const entry = scraped.find(e => e.projectName === pn);
    if (!entry) { console.log('NOT FOUND:', pn); continue; }
    const cn = pn.split(/\s+v\.?\s+/i)[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const mc = cases.find(c => c.client_name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cn));
    if (!mc) { console.log('NO MATCH:', pn); continue; }
    const existing = await (await fetch(`${BASE}/claim_details?case_id=eq.${mc.id}&limit=1`, { headers: H })).json();
    if (existing.length) { console.log('ALREADY EXISTS:', pn); continue; }
    const d = { case_id: mc.id };
    if (entry.policynumber) d.policy_number = entry.policynumber;
    if (entry.claimnumber) d.claim_number = entry.claimnumber;
    if (entry.Adjuster) d.adjuster_name = entry.Adjuster;
    if (entry.deductible) d.deductible = parseFloat(entry.deductible);
    if (entry.causeofloss) d.cause_of_loss = entry.causeofloss;
    if (entry['Date of Loss']) d.date_of_loss = pd(entry['Date of Loss']);
    if (entry['Type of Loss']) d.type_of_loss = entry['Type of Loss'];
    if (entry.typeofloss) d.type_of_loss_detail = entry.typeofloss;
    if (entry.insuredpropertyaddress) d.property_address = entry.insuredpropertyaddress;
    if (entry['Insured Property State']) d.insured_property_state = entry['Insured Property State'];
    if (entry.insuredpropertyzipcode) d.insured_property_zip = entry.insuredpropertyzipcode;
    if (entry['Policy Period Start']) d.policy_period_start = pd(entry['Policy Period Start']);
    if (entry['Policy Period End']) d.policy_period_end = pd(entry['Policy Period End']);
    if (entry.Dwelling) d.coverage_dwelling = parseFloat(entry.Dwelling);
    if (entry['Other Structure']) d.coverage_other_structure = parseFloat(entry['Other Structure']);
    if (entry.Contents) d.coverage_contents = parseFloat(entry.Contents);
    if (entry['Estimate for Total Damages']) d.estimate_total = parseFloat(entry['Estimate for Total Damages']);
    if (entry['Date of Estimate']) d.estimate_date = pd(entry['Date of Estimate']);
    if (entry['Date of Intake']) d.date_of_intake = pd(entry['Date of Intake']);
    const r = await fetch(`${BASE}/claim_details`, { method: 'POST', headers: H, body: JSON.stringify(d) });
    const res = await r.json();
    console.log(pn, r.ok ? 'INSERTED' : 'ERROR', r.ok ? '' : JSON.stringify(res));
  }
}
main();
