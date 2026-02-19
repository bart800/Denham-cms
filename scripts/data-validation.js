const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("=== DENHAM CMS DATA VALIDATION ===\n");

  // 1. Core counts
  const tables = ["cases", "documents", "case_emails", "case_notes", "case_tasks", "case_calls",
    "team_members", "estimates", "negotiations", "discovery_sets", "activity_log",
    "claim_details", "litigation_details", "portal_sessions", "portal_messages"];

  console.log("TABLE COUNTS:");
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("id", { count: "exact", head: true });
    console.log(`  ${t}: ${error ? "ERROR - " + error.message : count}`);
  }

  // 2. Document linking stats
  const { count: totalDocs } = await supabase.from("documents").select("id", { count: "exact", head: true });
  const { count: linkedDocs } = await supabase.from("documents").select("id", { count: "exact", head: true }).not("case_id", "is", null);
  const { count: unlinkedDocs } = await supabase.from("documents").select("id", { count: "exact", head: true }).is("case_id", null);
  console.log(`\nDOCUMENT LINKING:`);
  console.log(`  Total: ${totalDocs} | Linked: ${linkedDocs} | Unlinked: ${unlinkedDocs} | Rate: ${((linkedDocs/totalDocs)*100).toFixed(1)}%`);

  // 3. Cases with missing critical fields
  const { data: cases } = await supabase.from("cases").select("id, ref, client_name, status, type, insurer, jurisdiction, date_of_loss, attorney_id, statute_of_limitations");
  console.log(`\nCASE DATA QUALITY (${cases.length} cases):`);
  const missing = { insurer: 0, jurisdiction: 0, date_of_loss: 0, attorney_id: 0, statute_of_limitations: 0, type: 0 };
  cases.forEach(c => {
    if (!c.insurer) missing.insurer++;
    if (!c.jurisdiction) missing.jurisdiction++;
    if (!c.date_of_loss) missing.date_of_loss++;
    if (!c.attorney_id) missing.attorney_id++;
    if (!c.statute_of_limitations) missing.statute_of_limitations++;
    if (!c.type) missing.type++;
  });
  for (const [field, count] of Object.entries(missing)) {
    const pct = ((count / cases.length) * 100).toFixed(1);
    const status = count === 0 ? "✅" : count < 10 ? "⚠️" : "❌";
    console.log(`  ${status} ${field}: ${count} missing (${pct}%)`);
  }

  // 4. Status distribution
  const statusCounts = {};
  cases.forEach(c => { statusCounts[c.status || "null"] = (statusCounts[c.status || "null"] || 0) + 1; });
  console.log(`\nSTATUS PIPELINE:`);
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log(`  ${s}: ${c}`);
  });

  // 5. Type distribution
  const typeCounts = {};
  cases.forEach(c => { typeCounts[c.type || "null"] = (typeCounts[c.type || "null"] || 0) + 1; });
  console.log(`\nTYPE DISTRIBUTION:`);
  Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => {
    console.log(`  ${t}: ${c}`);
  });

  // 6. Orphan checks — docs linked to non-existent cases
  const caseIds = new Set(cases.map(c => c.id));
  const { data: linkedDocSample } = await supabase.from("documents").select("id, case_id").not("case_id", "is", null).limit(1000);
  const orphanDocs = (linkedDocSample || []).filter(d => !caseIds.has(d.case_id));
  console.log(`\nORPHAN CHECKS:`);
  console.log(`  Docs linked to non-existent cases (sample of 1000): ${orphanDocs.length}`);

  // 7. Team members
  const { data: team } = await supabase.from("team_members").select("id, name, role, title");
  console.log(`\nTEAM MEMBERS (${team.length}):`);
  team.forEach(t => console.log(`  ${t.name} — ${t.title || t.role || "no role"}`));

  // 8. SOL urgency
  const now = new Date();
  const sol30 = cases.filter(c => {
    if (!c.statute_of_limitations) return false;
    const d = new Date(c.statute_of_limitations);
    return d >= now && d <= new Date(now.getTime() + 30 * 86400000);
  });
  const solExpired = cases.filter(c => {
    if (!c.statute_of_limitations) return false;
    return new Date(c.statute_of_limitations) < now && !["Closed", "Settled", "Settlement"].includes(c.status);
  });
  console.log(`\nSOL STATUS:`);
  console.log(`  Due in 30 days: ${sol30.length}`);
  console.log(`  Expired (active cases): ${solExpired.length}`);
  if (solExpired.length > 0) {
    console.log(`  ⚠️ EXPIRED SOL CASES:`);
    solExpired.forEach(c => console.log(`    ${c.ref} - ${c.client_name} (SOL: ${c.statute_of_limitations}, Status: ${c.status})`));
  }

  console.log("\n=== VALIDATION COMPLETE ===");
}

main().catch(console.error);
