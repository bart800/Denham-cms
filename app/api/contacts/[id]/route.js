import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function GET(request, { params }) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { id } = await params;

    const { data: contact, error } = await db.from("contacts").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Get linked cases
    const { data: links } = await db
      .from("case_contacts")
      .select("role, notes, case_id, cases(id, ref, client_name, status)")
      .eq("contact_id", id);

    const linked_cases = (links || []).map((l) => ({
      case_id: l.case_id,
      ref: l.cases?.ref,
      client_name: l.cases?.client_name,
      status: l.cases?.status,
      role: l.role,
      notes: l.notes,
    }));

    return NextResponse.json({ ...contact, linked_cases });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await db.from("contacts").update(body).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { id } = await params;

    const { error } = await db.from("contacts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
