import { supabaseAdmin, supabase as supabaseAnon } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabaseAnon;

export async function POST(request) {
  try {
    const { client_name, property_address, insurer, claim_number } = await request.json();
    const conflicts = [];

    // Search by client name (fuzzy)
    if (client_name?.trim()) {
      const { data } = await db
        .from("cases")
        .select("id, ref, client_name, status, insurer, property_address")
        .ilike("client_name", `%${client_name.trim()}%`)
        .limit(10);
      if (data?.length) {
        conflicts.push(...data.map(c => ({ ...c, match_type: "client_name" })));
      }
    }

    // Search by property address
    if (property_address?.trim() && property_address.trim().length > 5) {
      const { data } = await db
        .from("cases")
        .select("id, ref, client_name, status, insurer, property_address")
        .ilike("property_address", `%${property_address.trim()}%`)
        .limit(10);
      if (data?.length) {
        for (const c of data) {
          if (!conflicts.find(x => x.id === c.id)) {
            conflicts.push({ ...c, match_type: "property_address" });
          }
        }
      }
    }

    // Search by insurer + claim number (exact match)
    if (insurer?.trim() && claim_number?.trim()) {
      const { data } = await db
        .from("cases")
        .select("id, ref, client_name, status, insurer, claim_number")
        .ilike("insurer", `%${insurer.trim()}%`)
        .ilike("claim_number", `%${claim_number.trim()}%`)
        .limit(5);
      if (data?.length) {
        for (const c of data) {
          if (!conflicts.find(x => x.id === c.id)) {
            conflicts.push({ ...c, match_type: "insurer_claim" });
          }
        }
      }
    }

    return NextResponse.json({ conflicts, hasConflicts: conflicts.length > 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
