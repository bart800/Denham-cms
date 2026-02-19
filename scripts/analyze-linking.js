const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Check columns on documents table
  const { data: sample } = await supabase.from("documents").select("*").limit(1);
  console.log("Document columns:", Object.keys(sample[0]));

  // Check if file_path exists
  const hasFilePath = sample[0].hasOwnProperty("file_path");
  console.log("Has file_path:", hasFilePath);

  // Load clio index
  const clio = JSON.parse(fs.readFileSync("data/clio-index.json", "utf8"));
  console.log("Clio cases:", clio.totalCases, "files:", clio.totalFiles);
  
  // Get all clio folder names
  const clioNames = clio.cases.map(c => c.name);
  console.log("Sample clio names:", clioNames.slice(0, 10));

  // Get all DB cases
  const { data: cases } = await supabase.from("cases").select("id, ref, client_name");
  console.log("DB cases:", cases.length);

  // Try to match clio names to case client_names
  let matched = 0, unmatched = [];
  const clioToCase = {};
  for (const cn of clioNames) {
    const exact = cases.find(c => c.client_name === cn);
    if (exact) {
      matched++;
      clioToCase[cn] = exact;
    } else {
      // Try case-insensitive
      const ci = cases.find(c => c.client_name.toLowerCase() === cn.toLowerCase());
      if (ci) {
        matched++;
        clioToCase[cn] = ci;
      } else {
        unmatched.push(cn);
      }
    }
  }
  console.log("\nClio→Case matching:");
  console.log("  Exact/CI match:", matched);
  console.log("  Unmatched:", unmatched.length);
  if (unmatched.length <= 30) {
    console.log("  Unmatched names:", unmatched);
  } else {
    console.log("  First 30 unmatched:", unmatched.slice(0, 30));
  }

  // Get distinct top-level folders from unlinked docs
  const { data: unlinkedSample } = await supabase
    .from("documents")
    .select("original_path")
    .is("case_id", null)
    .not("original_path", "is", null)
    .limit(1000);

  const topFolders = {};
  for (const d of (unlinkedSample || [])) {
    const p = d.original_path || "";
    // Split on backslash (Windows paths)
    const parts = p.split("\\");
    let top = parts[0];
    // Handle CLOSED\Name pattern
    if (top === "CLOSED" && parts.length > 1) top = parts[1];
    topFolders[top] = (topFolders[top] || 0) + 1;
  }
  
  const sortedFolders = Object.entries(topFolders).sort((a, b) => b[1] - a[1]);
  console.log("\nTop doc folders (from 1000 samples):", sortedFolders.slice(0, 20));

  // Can we update with anon key?
  // Try a dry-run update on a single doc
  const { data: testDoc } = await supabase.from("documents").select("id, case_id").is("case_id", null).limit(1);
  if (testDoc && testDoc[0]) {
    const { error: updateErr } = await supabase
      .from("documents")
      .update({ case_id: "00000000-0000-0000-0000-000000000000" })
      .eq("id", testDoc[0].id);
    console.log("\nAnon key update test:", updateErr ? "BLOCKED - " + updateErr.message : "ALLOWED");
    // Revert if it worked
    if (!updateErr) {
      await supabase.from("documents").update({ case_id: null }).eq("id", testDoc[0].id);
      console.log("Reverted test update");
    }
  }
}

main().catch(console.error);
