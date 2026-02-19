import { supabaseAdmin, supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const WORKFLOW_TEMPLATES = {
  "Intake": [
    { title: "Review signed retainer", priority: "high" },
    { title: "Verify insurance policy info", priority: "high" },
    { title: "File claim if not filed", priority: "medium" },
    { title: "Request claim file from insurer", priority: "medium" },
    { title: "Order property inspection", priority: "medium" },
  ],
  "Investigation": [
    { title: "Obtain independent estimate", priority: "high" },
    { title: "Review denial letter", priority: "high" },
    { title: "Document property damage (photos)", priority: "medium" },
    { title: "Review policy coverage", priority: "high" },
    { title: "Check statute of limitations", priority: "urgent" },
  ],
  "Presuit Demand": [
    { title: "Draft demand letter", priority: "high" },
    { title: "Compile supporting documents", priority: "medium" },
    { title: "Calculate damages", priority: "high" },
    { title: "Send demand to insurer", priority: "high" },
    { title: "Calendar 30-day follow-up", priority: "medium" },
  ],
  "Presuit Negotiation": [
    { title: "Review insurer response", priority: "high" },
    { title: "Prepare counter-offer if needed", priority: "medium" },
    { title: "Document all offers/counters", priority: "medium" },
    { title: "Evaluate settlement vs litigation", priority: "high" },
  ],
  "Litigation - Filed": [
    { title: "Draft and file complaint", priority: "urgent" },
    { title: "Serve defendant", priority: "high" },
    { title: "Calendar answer deadline", priority: "high" },
    { title: "Prepare initial disclosures", priority: "medium" },
  ],
  "Litigation - Discovery": [
    { title: "Draft interrogatories", priority: "high" },
    { title: "Draft requests for production", priority: "high" },
    { title: "Draft requests for admissions", priority: "medium" },
    { title: "Review defendant responses", priority: "high" },
    { title: "Schedule depositions", priority: "medium" },
  ],
  "Settled": [
    { title: "Prepare settlement agreement", priority: "urgent" },
    { title: "Obtain client signature", priority: "high" },
    { title: "Submit to insurer for payment", priority: "high" },
    { title: "Calculate attorney fees", priority: "medium" },
    { title: "Close file checklist", priority: "medium" },
  ],
};

// Build a smart template that accounts for existing case data
function getSmartTemplate(status, caseContext) {
  const base = WORKFLOW_TEMPLATES[status] || [];
  const { hasLitigation, hasNegotiations, hasEstimates, hasPleadings, hasEmails, filedDate, hasDiscovery } = caseContext;
  
  // Filter out tasks that are clearly already done based on case data
  return base.filter(task => {
    const t = task.title.toLowerCase();
    // If complaint already filed, skip drafting/filing/serving tasks
    if (filedDate) {
      if (t.includes("draft and file complaint")) return false;
      if (t.includes("serve defendant")) return false;
    }
    // If we already have negotiations, skip "evaluate settlement vs litigation" in presuit
    if (hasLitigation && t.includes("evaluate settlement vs litigation")) return false;
    // If estimates exist, skip "obtain independent estimate"
    if (hasEstimates && t.includes("obtain independent estimate")) return false;
    return true;
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;

  // Get case with related data counts
  const [caseRes, litRes, negRes, estRes, pleadRes, discRes, emailRes] = await Promise.all([
    db.from("cases").select("status").eq("id", id).single(),
    db.from("litigation_details").select("filed_date").eq("case_id", id).maybeSingle(),
    db.from("negotiations").select("id").eq("case_id", id),
    db.from("estimates").select("id").eq("case_id", id),
    db.from("pleadings").select("id").eq("case_id", id),
    db.from("discovery_sets").select("id").eq("case_id", id),
    db.from("case_emails").select("id").eq("case_id", id).limit(1),
  ]);

  if (caseRes.error || !caseRes.data) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const status = caseRes.data.status;
  const caseContext = {
    hasLitigation: !!litRes.data,
    filedDate: litRes.data?.filed_date,
    hasNegotiations: (negRes.data?.length || 0) > 0,
    hasEstimates: (estRes.data?.length || 0) > 0,
    hasPleadings: (pleadRes.data?.length || 0) > 0,
    hasDiscovery: (discRes.data?.length || 0) > 0,
    hasEmails: (emailRes.data?.length || 0) > 0,
  };

  const template = getSmartTemplate(status, caseContext);

  // Get existing tasks for this case
  const { data: existingTasks } = await db
    .from("case_tasks")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    phase: status,
    template,
    tasks: existingTasks || [],
    allTemplates: WORKFLOW_TEMPLATES,
    context: caseContext,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;

  // Get case status
  const { data: caseData, error: caseErr } = await db
    .from("cases")
    .select("status")
    .eq("id", id)
    .single();

  if (caseErr || !caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const status = caseData.status;
  const template = WORKFLOW_TEMPLATES[status];

  if (!template || template.length === 0) {
    return NextResponse.json({ error: "No workflow template for phase: " + status }, { status: 400 });
  }

  // Get existing tasks to avoid duplicates
  const { data: existingTasks } = await db
    .from("case_tasks")
    .select("title")
    .eq("case_id", id);

  const existingTitles = new Set((existingTasks || []).map(t => t.title.toLowerCase()));

  const toInsert = template
    .filter(t => !existingTitles.has(t.title.toLowerCase()))
    .map(t => ({
      case_id: id,
      title: t.title,
      description: `Auto-generated for ${status} phase`,
      priority: t.priority,
      status: "pending",
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "All tasks already exist", created: 0 });
  }

  const { data: inserted, error: insertErr } = await db
    .from("case_tasks")
    .insert(toInsert)
    .select();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: `Created ${inserted.length} tasks`, created: inserted.length, tasks: inserted });
}
