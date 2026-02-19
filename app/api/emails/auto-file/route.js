import { supabaseAdmin } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

// GET — return unmatched emails (case_id IS NULL)
export async function GET(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");
  const search = searchParams.get("search") || "";

  let query = supabaseAdmin
    .from("case_emails")
    .select("*", { count: "exact" })
    .is("case_id", null)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%,to_address.ilike.%${search}%`);
  }

  const { data: emails, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch suggested case matches for each email based on from_address
  const uniqueAddresses = [...new Set(emails.map(e => e.from_address).filter(Boolean))];
  let suggestions = {};

  if (uniqueAddresses.length > 0) {
    // Look up cases that have previous matched emails from these addresses
    const { data: matched } = await supabaseAdmin
      .from("case_emails")
      .select("case_id, from_address")
      .not("case_id", "is", null)
      .in("from_address", uniqueAddresses);

    if (matched) {
      for (const m of matched) {
        if (!suggestions[m.from_address]) suggestions[m.from_address] = new Set();
        suggestions[m.from_address].add(m.case_id);
      }
    }

    // Convert sets to arrays and fetch case names
    const allCaseIds = [...new Set(Object.values(suggestions).flatMap(s => [...s]))];
    if (allCaseIds.length > 0) {
      const { data: cases } = await supabaseAdmin
        .from("cases")
        .select("id, client_name, case_number, status")
        .in("id", allCaseIds);

      const caseMap = {};
      if (cases) cases.forEach(c => { caseMap[c.id] = c; });

      for (const addr of Object.keys(suggestions)) {
        suggestions[addr] = [...suggestions[addr]].map(id => caseMap[id]).filter(Boolean);
      }
    }
  }

  return NextResponse.json({ emails, total: count, suggestions });
}

// POST — manually assign an email to a case
export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { emailId, caseId } = await req.json();
  if (!emailId || !caseId) return NextResponse.json({ error: "emailId and caseId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("case_emails")
    .update({ case_id: caseId, matched_by: "manual" })
    .eq("id", emailId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, email: data });
}
