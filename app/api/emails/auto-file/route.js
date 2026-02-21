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

  // Smart matching with confidence scores
  // 1. Load all cases for matching
  const { data: allCases } = await supabaseAdmin
    .from("cases")
    .select("id, client_name, client_email, case_number, ref, insurer, status")
    .not("status", "in", "(Closed)");

  // 2. Load case_contacts for contact email matching
  const { data: contacts } = await supabaseAdmin
    .from("case_contacts")
    .select("case_id, email, name, role");

  // 3. Load previously matched emails for address-based suggestions
  const uniqueAddresses = [...new Set(emails.map(e => e.from_address).filter(Boolean))];
  let addressHistory = {};
  if (uniqueAddresses.length > 0) {
    const { data: matched } = await supabaseAdmin
      .from("case_emails")
      .select("case_id, from_address")
      .not("case_id", "is", null)
      .in("from_address", uniqueAddresses);
    if (matched) {
      for (const m of matched) {
        if (!addressHistory[m.from_address]) addressHistory[m.from_address] = new Set();
        addressHistory[m.from_address].add(m.case_id);
      }
    }
  }

  const caseMap = {};
  if (allCases) allCases.forEach(c => { caseMap[c.id] = c; });

  // Build contact email → case_id map
  const contactEmailMap = {};
  if (contacts) contacts.forEach(ct => {
    if (ct.email) {
      const e = ct.email.toLowerCase();
      if (!contactEmailMap[e]) contactEmailMap[e] = [];
      contactEmailMap[e].push({ caseId: ct.case_id, name: ct.name, role: ct.role });
    }
  });

  // Match each email
  const suggestions = {};
  for (const email of emails) {
    const matches = {}; // caseId -> { case, confidence, reasons[] }
    const addMatch = (caseId, confidence, reason) => {
      if (!caseMap[caseId]) return;
      if (!matches[caseId]) matches[caseId] = { case: caseMap[caseId], confidence: 0, reasons: [] };
      matches[caseId].confidence = Math.min(100, matches[caseId].confidence + confidence);
      matches[caseId].reasons.push(reason);
    };

    const fromAddr = (email.from_address || "").toLowerCase();
    const toAddr = (email.to_address || "").toLowerCase();
    const subject = (email.subject || "").toLowerCase();
    const allAddrs = [fromAddr, toAddr].filter(Boolean);

    // Method 1: Case reference number in subject (high confidence)
    if (allCases) for (const c of allCases) {
      if (c.ref && subject.includes(c.ref.toLowerCase())) addMatch(c.id, 90, `Ref "${c.ref}" in subject`);
      if (c.case_number && subject.includes(c.case_number.toLowerCase())) addMatch(c.id, 85, `Case # in subject`);
    }

    // Method 2: Client email match
    if (allCases) for (const c of allCases) {
      if (c.client_email) {
        const ce = c.client_email.toLowerCase();
        if (allAddrs.includes(ce)) addMatch(c.id, 80, `Client email match`);
      }
    }

    // Method 3: Client name in subject
    if (allCases) for (const c of allCases) {
      if (c.client_name && c.client_name.length > 3) {
        const parts = c.client_name.toLowerCase().split(/\s+/);
        const lastName = parts[parts.length - 1];
        if (lastName.length > 2 && subject.includes(lastName)) addMatch(c.id, 50, `Client name "${c.client_name}" in subject`);
      }
    }

    // Method 4: Insurer name in subject or from address
    if (allCases) for (const c of allCases) {
      if (c.insurer && c.insurer.length > 3) {
        const ins = c.insurer.toLowerCase();
        if (subject.includes(ins)) addMatch(c.id, 40, `Insurer "${c.insurer}" in subject`);
        if (fromAddr.includes(ins.split(/\s+/)[0])) addMatch(c.id, 35, `Insurer domain match`);
      }
    }

    // Method 5: Contact email match
    for (const addr of allAddrs) {
      const contactMatches = contactEmailMap[addr];
      if (contactMatches) {
        for (const cm of contactMatches) addMatch(cm.caseId, 70, `Contact "${cm.name || cm.role}" email match`);
      }
    }

    // Method 6: Historical address match (lower confidence)
    const histCases = addressHistory[email.from_address];
    if (histCases) {
      for (const caseId of histCases) addMatch(caseId, 60, `Previous emails from same address`);
    }

    // Sort by confidence, take top 5
    const sorted = Object.values(matches)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(m => ({ ...m.case, confidence: m.confidence, reasons: m.reasons }));

    if (sorted.length > 0) suggestions[email.id] = sorted;
  }

  return NextResponse.json({ emails, total: count, suggestions });
}

// PUT — auto-file high-confidence matches (batch)
export async function PUT(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  const { assignments } = await req.json();
  // assignments: [{ emailId, caseId, confidence }]
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return NextResponse.json({ error: "assignments array required" }, { status: 400 });
  }
  let filed = 0;
  for (const a of assignments) {
    const { error } = await supabaseAdmin
      .from("case_emails")
      .update({ case_id: a.caseId, matched_by: `auto_${a.confidence}` })
      .eq("id", a.emailId);
    if (!error) filed++;
  }
  return NextResponse.json({ success: true, filed, total: assignments.length });
}

// POST — manually assign email(s) to a case (supports bulk)
export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  
  // Bulk filing: { emailIds: [...], caseId }
  if (body.emailIds && Array.isArray(body.emailIds) && body.caseId) {
    const { error } = await supabaseAdmin
      .from("case_emails")
      .update({ case_id: body.caseId, matched_by: "manual_bulk" })
      .in("id", body.emailIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: body.emailIds.length });
  }

  // Single filing: { emailId, caseId }
  const { emailId, caseId } = body;
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
