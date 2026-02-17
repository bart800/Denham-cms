import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET() {
  try {
    const [teamRes, casesRes, docsRes, statusRes] = await Promise.all([
      db.from("team_members").select("*"),
      db.from("cases").select("id, status"),
      db.from("documents").select("id, file_size"),
      db.from("cases").select("status"),
    ]);

    const cases = casesRes.data || [];
    const documents = docsRes.data || [];
    const statusCounts = {};
    cases.forEach((c) => {
      statusCounts[c.status || "Unknown"] = (statusCounts[c.status || "Unknown"] || 0) + 1;
    });

    const storageBytes = documents.reduce((sum, d) => sum + (d.file_size || 0), 0);

    return NextResponse.json({
      team_members: teamRes.data || [],
      case_count: cases.length,
      document_count: documents.length,
      cases_by_status: statusCounts,
      storage_bytes: storageBytes,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
