import { supabaseAdmin } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const [totalRes, matchedRes, unmatchedRes, methodsRes] = await Promise.all([
    supabaseAdmin.from("case_emails").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("case_emails").select("*", { count: "exact", head: true }).not("case_id", "is", null),
    supabaseAdmin.from("case_emails").select("*", { count: "exact", head: true }).is("case_id", null),
    supabaseAdmin.from("case_emails").select("matched_by").not("case_id", "is", null),
  ]);

  // Count by match method
  const byMethod = {};
  if (methodsRes.data) {
    for (const row of methodsRes.data) {
      const m = row.matched_by || "unknown";
      byMethod[m] = (byMethod[m] || 0) + 1;
    }
  }

  return NextResponse.json({
    total: totalRes.count || 0,
    matched: matchedRes.count || 0,
    unmatched: unmatchedRes.count || 0,
    byMethod,
  });
}
