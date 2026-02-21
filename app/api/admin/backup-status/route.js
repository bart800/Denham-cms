import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    if (!key) return NextResponse.json({ error: "No service key" }, { status: 500 });
    const sb = createClient(url, key);

    const tables = ["cases", "documents", "team_members", "case_tasks"];
    const counts = {};
    const errors = [];

    for (const table of tables) {
      const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
      if (error) {
        errors.push({ table, error: error.message });
        counts[table] = -1;
      } else {
        counts[table] = count;
      }
    }

    // Get last verification
    const { data: lastVerify } = await sb
      .from("backup_verification")
      .select("*")
      .order("verified_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      status: errors.length > 0 ? "degraded" : "healthy",
      timestamp: new Date().toISOString(),
      table_counts: counts,
      errors: errors.length > 0 ? errors : undefined,
      last_verification: lastVerify || null,
      db_connected: true,
    });
  } catch (err) {
    return NextResponse.json({ status: "error", db_connected: false, error: err.message }, { status: 500 });
  }
}
