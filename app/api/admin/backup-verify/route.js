import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MATON_KEY = process.env.MATON_API_KEY;
const ALERT_EMAIL = "bart@bartdenhamlaw.com";
const CRITICAL_TABLES = ["cases", "documents", "team_members", "case_tasks"];
const LOSS_THRESHOLD = 0.10;

async function sendAlert(subject, body) {
  if (!MATON_KEY) { console.warn("No MATON_API_KEY, skipping email alert"); return; }
  try {
    await fetch("https://gateway.maton.ai/outlook/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${MATON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: ALERT_EMAIL } }],
        },
      }),
    });
  } catch (e) {
    console.error("Alert email failed:", e.message);
  }
}

export async function GET() {
  try {
    if (!key) return NextResponse.json({ error: "No service key" }, { status: 500 });
    const sb = createClient(url, key);

    const counts = {};
    const issues = [];

    for (const table of CRITICAL_TABLES) {
      const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
      if (error) {
        issues.push(`Cannot read ${table}: ${error.message}`);
        counts[table] = -1;
      } else {
        counts[table] = count;
      }
    }

    // Compare with last OK verification
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
            issues.push(`${table}: dropped from ${prevCount} to ${currCount} (${(loss * 100).toFixed(1)}% loss)`);
          }
        }
      }
    }

    const status = issues.length > 0 ? "warning" : "ok";
    const notes = issues.length > 0 ? issues.join("\n") : "All tables healthy";

    // Record
    await sb.from("backup_verification").insert({ table_counts: counts, status, notes });

    // Send alert if issues
    if (issues.length > 0) {
      await sendAlert(
        "⚠️ Denham CMS - Backup Verification Warning",
        `Backup verification detected potential issues:\n\n${issues.join("\n")}\n\nTable counts: ${JSON.stringify(counts, null, 2)}\n\nTimestamp: ${new Date().toISOString()}`
      );
    }

    return NextResponse.json({ status, timestamp: new Date().toISOString(), table_counts: counts, issues, notes });
  } catch (err) {
    return NextResponse.json({ status: "error", error: err.message }, { status: 500 });
  }
}
