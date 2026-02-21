import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request) {
  try {
    const { case_ids, operation, value, user_id, user_name } = await request.json();

    if (!case_ids?.length || !operation || value === undefined) {
      return NextResponse.json({ error: "case_ids, operation, and value are required" }, { status: 400 });
    }

    if (!["status", "attorney_id", "phase"].includes(operation)) {
      return NextResponse.json({ error: "Invalid operation. Use: status, attorney_id, phase" }, { status: 400 });
    }

    const results = { success: [], failed: [] };

    for (const caseId of case_ids) {
      try {
        const updateData = {};
        if (operation === "status" || operation === "phase") updateData.status = value;
        if (operation === "attorney_id") updateData.attorney_id = value;
        updateData.updated_at = new Date().toISOString();

        const { error } = await supabaseAdmin
          .from("cases")
          .update(updateData)
          .eq("id", caseId);

        if (error) throw error;

        // Log audit trail
        await supabaseAdmin.from("activity_log").insert({
          case_id: caseId,
          action_type: "status_change",
          description: `Batch ${operation} change to "${value}"`,
          performed_by: user_name || "System",
          user_id: user_id || null,
        }).catch(() => {});

        results.success.push(caseId);
      } catch (err) {
        results.failed.push({ id: caseId, error: err.message });
      }
    }

    return NextResponse.json({
      message: `Updated ${results.success.length} of ${case_ids.length} cases`,
      ...results,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
