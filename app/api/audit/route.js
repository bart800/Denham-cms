import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const userType = searchParams.get("user_type");
  const action = searchParams.get("action");
  const entityType = searchParams.get("entity_type");
  const entityId = searchParams.get("entity_id");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabaseAdmin
    .from("audit_trail")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) query = query.eq("user_id", userId);
  if (userType) query = query.eq("user_type", userType);
  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [], count });
}

export async function POST(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from("audit_trail")
    .insert({
      user_type: body.user_type || "staff",
      user_id: body.user_id,
      action: body.action,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      changes: body.changes,
      ip_address: body.ip_address,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
