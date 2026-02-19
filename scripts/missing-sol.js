const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data } = await supabase
    .from("cases")
    .select("ref, client_name, status, type, jurisdiction, date_of_loss, insurer, attorney:team_members!cases_attorney_id_fkey(name)")
    .is("statute_of_limitations", null)
    .not("status", "in", '("Closed","Settlement","Settled","Referred")')
    .order("ref");

  console.log(`Active cases missing SOL date: ${data.length}\n`);
  console.log("Ref | Client | Status | Type | Jurisdiction | DOL | Insurer | Attorney");
  console.log("---|---|---|---|---|---|---|---");
  for (const c of data) {
    console.log(`${c.ref} | ${c.client_name} | ${c.status} | ${c.type} | ${c.jurisdiction} | ${c.date_of_loss || "?"} | ${c.insurer || "?"} | ${c.attorney?.name || "?"}`);
  }
}

main().catch(console.error);
