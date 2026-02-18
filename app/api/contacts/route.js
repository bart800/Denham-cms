import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function GET(request) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const tag = searchParams.get("tag");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let query = db.from("contacts").select("*", { count: "exact" });

    if (q) {
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
      );
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }
    if (type) {
      query = query.eq("type", type);
    }

    query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ contacts: data, total: count, page, limit });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const body = await request.json();
    const { data, error } = await db.from("contacts").insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
