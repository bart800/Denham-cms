import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSb() {
  if (!key) throw new Error("No service key");
  return createClient(url, key);
}

// GET - List all referral sources with stats
export async function GET(req) {
  try {
    const sb = getSb();
    const { searchParams } = new URL(req.url);
    const withStats = searchParams.get("stats") !== "false";

    const { data: sources, error } = await sb
      .from("referral_sources")
      .select("*")
      .order("cases_count", { ascending: false });

    if (error) throw error;

    if (withStats && sources?.length) {
      // Enrich with live case stats
      const { data: cases } = await sb
        .from("cases")
        .select("id, referral_source, referral_source_detail, status, settlement_amount, total_recovery")
        .not("referral_source", "is", null);

      for (const src of sources) {
        const matched = (cases || []).filter(
          c => c.referral_source === src.category || c.referral_source_detail === src.name
        );
        src.live_cases_count = matched.length;
        src.live_total_recovery = matched.reduce((sum, c) => sum + (parseFloat(c.total_recovery || c.settlement_amount) || 0), 0);
        src.settled_count = matched.filter(c => c.status === "Settled" || c.status === "Closed").length;
        src.avg_recovery = src.settled_count > 0 ? src.live_total_recovery / src.settled_count : 0;
        src.conversion_rate = matched.length > 0 ? (src.settled_count / matched.length * 100).toFixed(1) : "0.0";
      }
    }

    return NextResponse.json(sources || []);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Create a new referral source
export async function POST(req) {
  try {
    const sb = getSb();
    const body = await req.json();
    const { name, category, contact_info, notes } = body;
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const { data, error } = await sb
      .from("referral_sources")
      .insert({ name, category, contact_info, notes })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT - Update a referral source
export async function PUT(req) {
  try {
    const sb = getSb();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const { data, error } = await sb
      .from("referral_sources")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Remove a referral source
export async function DELETE(req) {
  try {
    const sb = getSb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const { error } = await sb.from("referral_sources").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
