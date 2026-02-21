import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

// PATCH: Update case fields
export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  try {
    const updates = await request.json();
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from("cases").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Fetch case with attorney and support team member info
  const { data: caseData, error: caseError } = await supabaseAdmin
    .from("cases")
    .select(`
      *,
      attorney:team_members!cases_attorney_id_fkey(id, name, role, title, initials, color, email),
      support:team_members!cases_support_id_fkey(id, name, role, title, initials, color, email)
    `)
    .eq("id", id)
    .single();

  if (caseError) {
    if (caseError.code === "PGRST116") {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    return NextResponse.json({ error: caseError.message }, { status: 500 });
  }

  // Fetch all related data in parallel
  const [claimRes, litigationRes, negotiationsRes, estimatesRes, pleadingsRes] = await Promise.all([
    supabaseAdmin.from("claim_details").select("*").eq("case_id", id).maybeSingle(),
    supabaseAdmin.from("litigation_details").select("*").eq("case_id", id).maybeSingle(),
    supabaseAdmin.from("negotiations").select("*").eq("case_id", id).order("date", { ascending: false }),
    supabaseAdmin.from("estimates").select("*").eq("case_id", id).order("date", { ascending: false }),
    supabaseAdmin.from("pleadings").select("*").eq("case_id", id).order("date", { ascending: false }),
  ]);

  return NextResponse.json({
    ...caseData,
    claim_details: claimRes.data || null,
    litigation_details: litigationRes.data || null,
    negotiations: negotiationsRes.data || [],
    estimates: estimatesRes.data || [],
    pleadings: pleadingsRes.data || [],
  });
}
