import { supabaseAdmin, supabase } from "../../../lib/supabase";

/**
 * GET /api/search?q=...
 *
 * Universal search across cases, documents, notes, emails, and calls.
 *
 * Query params:
 *   q         — search query (required, min 2 chars)
 *   scope     — comma-separated: cases,documents,notes,emails,calls (default: all)
 *   limit     — results per entity type (default: 10, max: 50)
 *   case_id   — restrict search to a specific case
 */
export async function GET(request) {
  const client = supabaseAdmin || supabase;
  if (!client) return Response.json({ error: "No Supabase client" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ error: "Query must be at least 2 characters" }, { status: 400 });

  const scopeParam = searchParams.get("scope");
  const scopes = scopeParam
    ? scopeParam.split(",").map(s => s.trim().toLowerCase())
    : ["cases", "documents", "notes", "emails", "calls"];
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const caseId = searchParams.get("case_id");
  const pattern = `%${q}%`;

  try {
    const searches = {};

    if (scopes.includes("cases")) {
      searches.cases = searchCases(client, pattern, limit);
    }
    if (scopes.includes("documents")) {
      searches.documents = searchDocuments(client, pattern, limit, caseId);
    }
    if (scopes.includes("notes")) {
      searches.notes = searchNotes(client, pattern, limit, caseId);
    }
    if (scopes.includes("emails")) {
      searches.emails = searchEmails(client, pattern, limit, caseId);
    }
    if (scopes.includes("calls")) {
      searches.calls = searchCalls(client, pattern, limit, caseId);
    }

    const keys = Object.keys(searches);
    const results = await Promise.all(Object.values(searches));

    const response = { query: q };
    let totalHits = 0;
    for (let i = 0; i < keys.length; i++) {
      response[keys[i]] = results[i];
      totalHits += results[i].hits;
    }
    response.total_hits = totalHits;

    return Response.json(response);
  } catch (err) {
    console.error("[search] error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function searchCases(client, pattern, limit) {
  const { data, count, error } = await client
    .from("cases")
    .select(
      `id, ref, client_name, status, type, insurer, claim_number, jurisdiction,
       date_of_loss, property_address, cause_of_loss,
       attorney:team_members!cases_attorney_id_fkey(name)`,
      { count: "exact" }
    )
    .or(
      `client_name.ilike.${pattern},insurer.ilike.${pattern},claim_number.ilike.${pattern},policy_number.ilike.${pattern},ref.ilike.${pattern},property_address.ilike.${pattern},adjuster_name.ilike.${pattern},cause_of_loss.ilike.${pattern}`
    )
    .order("date_opened", { ascending: false })
    .limit(limit);

  if (error) return { hits: 0, total: 0, data: [], error: error.message };

  return {
    hits: (data || []).length,
    total: count || 0,
    data: (data || []).map(c => ({
      id: c.id,
      ref: c.ref,
      client_name: c.client_name,
      status: c.status,
      type: c.type,
      insurer: c.insurer,
      jurisdiction: c.jurisdiction,
      attorney: c.attorney?.name || null,
      _type: "case",
    })),
  };
}

async function searchDocuments(client, pattern, limit, caseId) {
  let query = client
    .from("documents")
    .select(
      `id, case_id, filename, category, extension, ai_summary, doc_type,
       case:cases!documents_case_id_fkey(ref, client_name)`,
      { count: "exact" }
    )
    .or(`filename.ilike.${pattern},ai_summary.ilike.${pattern},ai_extracted_text.ilike.${pattern},original_path.ilike.${pattern}`)
    .order("modified_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (caseId) query = query.eq("case_id", caseId);

  const { data, count, error } = await query;
  if (error) return { hits: 0, total: 0, data: [], error: error.message };

  return {
    hits: (data || []).length,
    total: count || 0,
    data: (data || []).map(d => ({
      id: d.id,
      case_id: d.case_id,
      case_ref: d.case?.ref || null,
      client_name: d.case?.client_name || null,
      filename: d.filename,
      category: d.category,
      extension: d.extension,
      doc_type: d.doc_type,
      ai_summary_preview: d.ai_summary ? d.ai_summary.slice(0, 200) : null,
      _type: "document",
    })),
  };
}

async function searchNotes(client, pattern, limit, caseId) {
  let query = client
    .from("case_notes")
    .select(
      `id, case_id, content, pinned, created_at,
       author:team_members!case_notes_author_id_fkey(name),
       case:cases!case_notes_case_id_fkey(ref, client_name)`,
      { count: "exact" }
    )
    .ilike("content", pattern)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (caseId) query = query.eq("case_id", caseId);

  const { data, count, error } = await query;
  if (error) return { hits: 0, total: 0, data: [], error: error.message };

  return {
    hits: (data || []).length,
    total: count || 0,
    data: (data || []).map(n => ({
      id: n.id,
      case_id: n.case_id,
      case_ref: n.case?.ref || null,
      client_name: n.case?.client_name || null,
      content_preview: n.content ? n.content.slice(0, 300) : null,
      pinned: n.pinned,
      author: n.author?.name || null,
      created_at: n.created_at,
      _type: "note",
    })),
  };
}

async function searchEmails(client, pattern, limit, caseId) {
  let query = client
    .from("case_emails")
    .select(
      `id, case_id, subject, from_address, to_address, direction, received_at,
       case:cases!case_emails_case_id_fkey(ref, client_name)`,
      { count: "exact" }
    )
    .or(`subject.ilike.${pattern},from_address.ilike.${pattern},to_address.ilike.${pattern},body_text.ilike.${pattern}`)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (caseId) query = query.eq("case_id", caseId);

  const { data, count, error } = await query;
  if (error) return { hits: 0, total: 0, data: [], error: error.message };

  return {
    hits: (data || []).length,
    total: count || 0,
    data: (data || []).map(e => ({
      id: e.id,
      case_id: e.case_id,
      case_ref: e.case?.ref || null,
      client_name: e.case?.client_name || null,
      subject: e.subject,
      from: e.from_address,
      direction: e.direction,
      received_at: e.received_at,
      _type: "email",
    })),
  };
}

async function searchCalls(client, pattern, limit, caseId) {
  let query = client
    .from("case_calls")
    .select(
      `id, case_id, call_id, direction, caller_name, external_number, duration_seconds,
       date_started, ai_summary, transcript,
       case:cases!case_calls_case_id_fkey(ref, client_name)`,
      { count: "exact" }
    )
    .or(`transcript.ilike.${pattern},ai_summary.ilike.${pattern},caller_name.ilike.${pattern},external_number.ilike.${pattern}`)
    .order("date_started", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (caseId) query = query.eq("case_id", caseId);

  const { data, count, error } = await query;
  if (error) return { hits: 0, total: 0, data: [], error: error.message };

  return {
    hits: (data || []).length,
    total: count || 0,
    data: (data || []).map(c => ({
      id: c.id,
      case_id: c.case_id,
      case_ref: c.case?.ref || null,
      client_name: c.case?.client_name || null,
      caller_name: c.caller_name,
      external_number: c.external_number,
      direction: c.direction,
      duration_seconds: c.duration_seconds,
      date_started: c.date_started,
      ai_summary_preview: c.ai_summary ? c.ai_summary.slice(0, 200) : null,
      _type: "call",
    })),
  };
}
