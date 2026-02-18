import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

export async function GET(request, { params }) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { id } = await params;

    const { data, error } = await db
      .from("case_contacts")
      .select("id, role, notes, created_at, contact_id, contacts(*)")
      .eq("case_id", id)
      .order("role");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const contacts = (data || []).map((row) => ({
      link_id: row.id,
      role: row.role,
      notes: row.notes,
      linked_at: row.created_at,
      ...row.contacts,
    }));

    return NextResponse.json({ contacts });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { id: case_id } = await params;
    const body = await request.json();
    const { contact_id, contact, role, notes } = body;

    if (!role) return NextResponse.json({ error: "role is required" }, { status: 400 });

    let cid = contact_id;

    // If no contact_id, create new contact first
    if (!cid && contact) {
      const { data: newContact, error: cErr } = await db
        .from("contacts")
        .insert(contact)
        .select()
        .single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      cid = newContact.id;
    }

    if (!cid) return NextResponse.json({ error: "contact_id or contact object required" }, { status: 400 });

    const { data, error } = await db
      .from("case_contacts")
      .insert({ case_id, contact_id: cid, role, notes })
      .select("*, contacts(*)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { id: case_id } = await params;
    const body = await request.json();
    const { contact_id, role } = body;

    if (!contact_id || !role) {
      return NextResponse.json({ error: "contact_id and role required" }, { status: 400 });
    }

    const { error } = await db
      .from("case_contacts")
      .delete()
      .eq("case_id", case_id)
      .eq("contact_id", contact_id)
      .eq("role", role);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
