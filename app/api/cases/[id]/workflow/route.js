import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

function determineCaseType(caseTypeStr) {
  if (!caseTypeStr) return "property";
  const lower = caseTypeStr.toLowerCase();
  if (lower.includes("pi") || lower.includes("personal injury") || lower === "mva") return "pi";
  return "property";
}

async function instantiateFromTemplates(caseId, caseType) {
  // Load ALL templates for this case type (all phases)
  const { data: allTemplates, error } = await db
    .from("workflow_templates")
    .select("*")
    .eq("case_type", caseType)
    .order("phase")
    .order("task_order");

  if (error || !allTemplates?.length) return [];

  const tasks = allTemplates.map((t) => ({
    case_id: caseId,
    title: t.title,
    description: t.description || "",
    priority: t.is_gate ? "high" : "medium",
    status: "pending",
    phase: t.phase,
    task_order: t.task_order,
    role: t.role,
    is_gate: t.is_gate,
    template_id: t.id,
    required_docs: t.required_docs,
    sop_reference: t.sop_reference,
    is_custom: false,
  }));

  const { data: inserted, error: insertErr } = await db
    .from("case_tasks")
    .insert(tasks)
    .select();

  if (insertErr) {
    console.error("Failed to insert tasks:", insertErr);
    return [];
  }

  // Map template dependencies to actual task IDs
  if (inserted?.length) {
    const templateToTask = {};
    for (const task of inserted) {
      if (task.template_id) templateToTask[task.template_id] = task.id;
    }
    const updates = [];
    for (const task of inserted) {
      const template = allTemplates.find((t) => t.id === task.template_id);
      if (template?.depends_on?.length) {
        const depTaskIds = template.depends_on
          .map((depTemplateId) => templateToTask[depTemplateId])
          .filter(Boolean);
        if (depTaskIds.length) {
          updates.push(
            db.from("case_tasks").update({ depends_on_tasks: depTaskIds }).eq("id", task.id)
          );
        }
      }
    }
    if (updates.length) {
      await Promise.all(updates);
      // Re-fetch to get updated depends_on_tasks
      const { data: refreshed } = await db
        .from("case_tasks")
        .select("*")
        .eq("case_id", caseId)
        .order("phase")
        .order("task_order");
      return refreshed || inserted;
    }
  }

  return inserted || [];
}

export async function GET(request, { params }) {
  const { id } = await params;

  const { data: caseData, error: caseErr } = await db
    .from("cases")
    .select("status, case_type")
    .eq("id", id)
    .single();

  if (caseErr || !caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const caseType = determineCaseType(caseData.case_type);

  // Load existing tasks
  let { data: tasks } = await db
    .from("case_tasks")
    .select("*")
    .eq("case_id", id)
    .order("phase")
    .order("task_order")
    .order("created_at");

  // If no tasks exist, auto-instantiate from templates for ALL phases
  if (!tasks || tasks.length === 0) {
    tasks = await instantiateFromTemplates(id, caseType);
  }

  return NextResponse.json({
    phase: caseData.status,
    case_type: caseType,
    tasks: tasks || [],
  });
}

export async function POST(request, { params }) {
  const { id } = await params;

  const { data: caseData, error: caseErr } = await db
    .from("cases")
    .select("status, case_type")
    .eq("id", id)
    .single();

  if (caseErr || !caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const caseType = determineCaseType(caseData.case_type);

  // Keep custom tasks
  const { data: existingCustom } = await db
    .from("case_tasks")
    .select("*")
    .eq("case_id", id)
    .eq("is_custom", true);

  // Delete all non-custom tasks
  await db
    .from("case_tasks")
    .delete()
    .eq("case_id", id)
    .or("is_custom.eq.false,is_custom.is.null");

  // Re-instantiate from templates (all phases)
  const newTasks = await instantiateFromTemplates(id, caseType);

  return NextResponse.json({
    message: `Regenerated ${newTasks.length} tasks from SOP templates`,
    tasks: [...(existingCustom || []), ...newTasks],
    customKept: existingCustom?.length || 0,
  });
}
