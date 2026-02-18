import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

function highlightSnippet(text, query, contextChars = 80) {
  if (!text || !query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  const snippet = (start > 0 ? "..." : "") +
    text.slice(start, idx) +
    `**${text.slice(idx, idx + query.length)}**` +
    text.slice(idx + query.length, end) +
    (end < text.length ? "..." : "");
  return snippet;
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "DB not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const caseId = searchParams.get("case_id");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const sort = searchParams.get("sort") || "date"; // date, duration, relevance
    const offset = (page - 1) * limit;

    if (!q) {
      return NextResponse.json({ error: "Query param 'q' is required" }, { status: 400 });
    }

    const pattern = `%${q}%`;

    let query = supabaseAdmin
      .from("case_calls")
      .select("*", { count: "exact" })
      .or(
        `transcript.ilike.${pattern},ai_summary.ilike.${pattern},caller_name.ilike.${pattern},callee_name.ilike.${pattern},caller_number.ilike.${pattern},callee_number.ilike.${pattern}`
      );

    if (caseId) {
      query = query.eq("case_id", caseId);
    }

    // Sorting
    if (sort === "duration") {
      query = query.order("duration_seconds", { ascending: false, nullsFirst: false });
    } else {
      // date (default) and relevance both sort by date for now
      query = query.order("started_at", { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add snippets
    const results = (data || []).map((call) => {
      const snippets = {};
      for (const field of ["transcript", "ai_summary", "caller_name", "callee_name", "caller_number", "callee_number"]) {
        const s = highlightSnippet(call[field], q);
        if (s) snippets[field] = s;
      }
      return { ...call, _snippets: snippets };
    });

    return NextResponse.json({
      results,
      total: count,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    });
  } catch (e) {
    console.error("[dialpad-search] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
