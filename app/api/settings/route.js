import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("id");
    if (!memberId) return NextResponse.json({ error: "Member ID required" }, { status: 400 });

    // Get member info first (for auth cleanup)
    const { data: member } = await db.from("team_members").select("id, email, auth_user_id").eq("id", memberId).single();
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Unassign from cases (set attorney_id/support_id to null)
    await db.from("cases").update({ attorney_id: null }).eq("attorney_id", memberId);
    await db.from("cases").update({ support_id: null }).eq("support_id", memberId);

    // Unassign from tasks
    await db.from("tasks").update({ assigned_to: null }).eq("assigned_to", memberId);

    // Delete auth user if exists
    if (member.auth_user_id && supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(member.auth_user_id);
      } catch (e) { console.warn("Failed to delete auth user:", e.message); }
    }

    // Delete team member
    const { error } = await db.from("team_members").delete().eq("id", memberId);
    if (error) throw error;

    return NextResponse.json({ success: true, removed: member.email });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
