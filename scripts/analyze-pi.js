const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Get PI cases
  const { data: piCases, error } = await supabase
    .from("cases")
    .select("id, ref, client_name, type, status, jurisdiction, date_of_loss, insurer, cause_of_loss")
    .eq("type", "Personal Injury");
  
  if (error) { console.log("Error:", error.message); return; }
  console.log("PI cases:", piCases.length);
  
  // Check which fields are empty
  let missingJurisdiction = 0, missingDOL = 0, missingInsurer = 0, missingCause = 0;
  for (const c of piCases) {
    if (!c.jurisdiction) missingJurisdiction++;
    if (!c.date_of_loss) missingDOL++;
    if (!c.insurer) missingInsurer++;
    if (!c.cause_of_loss) missingCause++;
  }
  console.log("Missing jurisdiction:", missingJurisdiction);
  console.log("Missing date_of_loss:", missingDOL);
  console.log("Missing insurer:", missingInsurer);
  console.log("Missing cause_of_loss:", missingCause);

  // Check filevine data
  const fvData = JSON.parse(fs.readFileSync("data/filevine-full-data.json", "utf8"));
  console.log("\nFilevine records:", Array.isArray(fvData) ? fvData.length : "not array - keys:", Object.keys(fvData).slice(0, 5));
  
  // Sample a filevine record
  const records = Array.isArray(fvData) ? fvData : fvData.projects || fvData.data || [];
  if (records.length > 0) {
    console.log("\nSample filevine record keys:", Object.keys(records[0]));
    console.log("Sample:", JSON.stringify(records[0], null, 2).slice(0, 1000));
  }

  // Also check extracted
  const extracted = JSON.parse(fs.readFileSync("data/filevine-extracted.json", "utf8"));
  console.log("\nExtracted records:", Array.isArray(extracted) ? extracted.length : typeof extracted);
  if (Array.isArray(extracted) && extracted.length > 0) {
    console.log("Extracted sample keys:", Object.keys(extracted[0]));
  }

  // Show PI cases missing data
  console.log("\nPI cases needing enrichment:");
  for (const c of piCases.filter(c => !c.jurisdiction || !c.date_of_loss || !c.insurer)) {
    console.log(`  ${c.ref} - ${c.client_name} | jur:${c.jurisdiction||'?'} dol:${c.date_of_loss||'?'} ins:${c.insurer||'?'}`);
  }
}

main().catch(console.error);
