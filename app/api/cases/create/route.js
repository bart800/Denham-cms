import { supabaseAdmin } from "@/lib/supabase";
import { logAudit, getRequestIP } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { client_name } = body;

    if (!client_name || !client_name.trim()) {
      return NextResponse.json({ error: "client_name is required" }, { status: 400 });
    }

    // Generate ref: DC-YYYY-NNNN
    const year = new Date().getFullYear();
    const prefix = `DC-${year}-`;

    const { data: lastCase } = await supabaseAdmin
      .from("cases")
      .select("ref")
      .like("ref", `${prefix}%`)
      .order("ref", { ascending: false })
      .limit(1)
      .single();

    let seq = 1;
    if (lastCase?.ref) {
      const lastSeq = parseInt(lastCase.ref.split("-").pop(), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    const ref = `${prefix}${String(seq).padStart(4, "0")}`;

    // Build insert object with only valid fields
    const allowedFields = [
      "client_name", "type", "insurer", "jurisdiction", "date_of_loss",
      "statute_of_limitations", "claim_number", "policy_number",
      "client_phone", "client_email", "attorney_id", "support_id",
      "property_address", "cause_of_loss", "adjuster_name",
      "adjuster_phone", "adjuster_email"
    ];

    const insert = { ref, status: "Open" };
    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
        insert[field] = body[field];
      }
    }

    const { data, error } = await supabaseAdmin
      .from("cases")
      .insert(insert)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create claim_details record with intake data
    const claimFields = {};
    const claimMap = {
      insurer: "insurer", claim_number: "claim_number", policy_number: "policy_number",
      date_of_loss: "date_of_loss", cause_of_loss: "cause_of_loss",
      property_address: "property_address", adjuster_name: "adjuster_name",
      adjuster_phone: "adjuster_phone", adjuster_email: "adjuster_email",
      date_reported: "date_reported", date_denied: "date_denied",
    };
    for (const [bodyKey, dbKey] of Object.entries(claimMap)) {
      if (body[bodyKey] !== undefined && body[bodyKey] !== null && body[bodyKey] !== "") {
        claimFields[dbKey] = body[bodyKey];
      }
    }
    if (Object.keys(claimFields).length > 0) {
      await supabaseAdmin
        .from("claim_details")
        .insert({ case_id: data.id, ...claimFields });
    }

    // Audit log
    await logAudit({
      userId: body.created_by || body.attorney_id,
      action: "create",
      entityType: "case",
      entityId: data.id,
      newValues: { ref, client_name, status: "Open" },
      ipAddress: getRequestIP(request),
      description: `Created case ${ref} for ${client_name}`,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
