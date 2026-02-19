const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data } = await supabase.from("cases").select("id, client_email, client_phone");
  const hasEmail = data.filter(c => c.client_email).length;
  const hasPhone = data.filter(c => c.client_phone).length;
  const hasBoth = data.filter(c => c.client_email && c.client_phone).length;
  const hasNeither = data.filter(c => !c.client_email && !c.client_phone).length;
  console.log(`Total cases: ${data.length}`);
  console.log(`Has email: ${hasEmail} (${((hasEmail/data.length)*100).toFixed(1)}%)`);
  console.log(`Has phone: ${hasPhone} (${((hasPhone/data.length)*100).toFixed(1)}%)`);
  console.log(`Has both: ${hasBoth}`);
  console.log(`Has neither: ${hasNeither}`);
}
main().catch(console.error);
