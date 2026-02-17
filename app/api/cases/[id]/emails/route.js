import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = (page - 1) * limit;

    const { data, error, count } = await db
      .from("case_emails")
      .select("*", { count: "exact" })
      .eq("case_id", id)
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      emails: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("GET /api/cases/[id]/emails error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const record = {
      case_id: id,
      subject: body.subject || null,
      from_address: body.from_address || null,
      to_address: body.to_address || null,
      cc_address: body.cc_address || null,
      body_text: body.body_text || null,
      body_html: body.body_html || null,
      received_at: body.received_at || new Date().toISOString(),
      direction: body.direction || "inbound",
      read: body.read ?? false,
      starred: body.starred ?? false,
    };

    const { data, error } = await db
      .from("case_emails")
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/cases/[id]/emails error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
