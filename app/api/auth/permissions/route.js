import { supabaseAdmin } from "@/lib/supabase";
import { getPermissions } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("member_id");

  if (!memberId) {
    return NextResponse.json({ error: "member_id required" }, { status: 400 });
  }

  const { data: member, error } = await supabaseAdmin
    .from("team_members")
    .select("id, name, role, email")
    .eq("id", memberId)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const permissions = getPermissions(member.role);

  return NextResponse.json({
    member_id: member.id,
    name: member.name,
    role: member.role,
    permissions,
  });
}
