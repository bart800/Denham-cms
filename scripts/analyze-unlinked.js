const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Count total docs
  const { count: total, error: e1 } = await supabase.from("documents").select("id", { count: "exact", head: true });
  console.log("Total documents:", total, e1?.message || "OK");

  // Count unlinked
  const { count: unlinked, error: e2 } = await supabase.from("documents").select("id", { count: "exact", head: true }).is("case_id", null);
  console.log("Unlinked (case_id is null):", unlinked, e2?.message || "OK");

  // Sample unlinked docs
  const { data: samples, error: e3 } = await supabase
    .from("documents")
    .select("id, storage_path, original_path, filename, category")
    .is("case_id", null)
    .limit(20);

  if (e3) { console.log("Sample error:", e3.message); return; }

  console.log("\nSample unlinked docs (" + (samples||[]).length + "):");
  for (const d of (samples || [])) {
    console.log(`  orig: ${d.original_path}`);
    console.log(`  stor: ${d.storage_path}`);
    console.log(`  file: ${d.filename} | cat: ${d.category}`);
    console.log();
  }

  // Get all cases
  const { data: cases } = await supabase.from("cases").select("id, ref, client_name").order("ref");
  console.log("Total cases:", (cases||[]).length);
  console.log("Sample:", (cases||[]).slice(0, 5).map(c => `${c.ref} - ${c.client_name}`));

  // Distinct top-level folders
  const { data: pathSamples } = await supabase
    .from("documents")
    .select("storage_path, original_path")
    .is("case_id", null)
    .limit(200);

  const folders = {};
  for (const d of (pathSamples || [])) {
    const p = d.original_path || d.storage_path || "";
    const parts = p.split("/").filter(Boolean);
    const top = parts[0] || "(empty)";
    folders[top] = (folders[top] || 0) + 1;
  }
  console.log("\nTop-level folders (from 200 samples):", JSON.stringify(folders, null, 2));
}

main().catch(console.error);
