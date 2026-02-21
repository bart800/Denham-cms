// Standalone backup verification script
// Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backup-verify.js
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("Need SUPABASE_SERVICE_ROLE_KEY env var"); process.exit(1); }

const sb = createClient(url, key);
const CRITICAL_TABLES = ["cases", "documents", "team_members", "case_tasks"];
const LOSS_THRESHOLD = 0.10; // 10%

async function verify() {
  console.log("🔍 Running backup verification...");
  const counts = {};
  const issues = [];

  // Count rows in critical tables
  for (const table of CRITICAL_TABLES) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) {
      issues.push(`❌ Cannot read ${table}: ${error.message}`);
      counts[table] = -1;
    } else {
      counts[table] = count;
      console.log(`  ${table}: ${count} rows`);
    }
  }

  // Get last verification to compare
  const { data: lastVerify } = await sb
    .from("backup_verification")
    .select("*")
    .eq("status", "ok")
    .order("verified_at", { ascending: false })
    .limit(1)
    .single();

  if (lastVerify?.table_counts) {
    const prev = lastVerify.table_counts;
    for (const table of CRITICAL_TABLES) {
      const prevCount = prev[table];
      const currCount = counts[table];
      if (prevCount > 0 && currCount >= 0) {
        const loss = (prevCount - currCount) / prevCount;
        if (loss > LOSS_THRESHOLD) {
          issues.push(`⚠️ ${table}: dropped from ${prevCount} to ${currCount} (${(loss * 100).toFixed(1)}% loss)`);
        }
      }
    }
  }

  const status = issues.length > 0 ? "warning" : "ok";
  const notes = issues.length > 0 ? issues.join("\n") : "All tables healthy";

  // Record verification
  const { error: insertErr } = await sb.from("backup_verification").insert({
    table_counts: counts,
    status,
    notes,
  });

  if (insertErr) console.error("Failed to record verification:", insertErr.message);

  console.log(`\nStatus: ${status}`);
  if (issues.length > 0) {
    console.log("Issues:");
    issues.forEach(i => console.log(`  ${i}`));
  } else {
    console.log("✅ All tables healthy - no data loss detected");
  }

  return { status, counts, issues, notes };
}

verify().catch(e => { console.error(e); process.exit(1); });
