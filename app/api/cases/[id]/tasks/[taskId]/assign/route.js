import { supabaseAdmin, supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/send-email";
import { NextResponse } from "next/server";
const db = supabaseAdmin || supabase;

export async function POST(request, { params }) {
  try {
    const { id, taskId } = await params;
    const { member_id } = await request.json();

    const { data, error } = await db
      .from("case_tasks")
      .update({ assigned_to: member_id || null, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("case_id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Send email notification to assigned member (fire-and-forget)
    if (member_id) {
      notifyAssignee(member_id, data, id).catch(err =>
        console.error("Assignment email failed:", err.message)
      );
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function notifyAssignee(memberId, task, caseId) {
  // Get member info
  const { data: member } = await db
    .from("team_members")
    .select("id, name, email, notification_preferences")
    .eq("id", memberId)
    .single();

  if (!member?.email) return;

  const prefs = member.notification_preferences || {};
  if (prefs.email_enabled === false || prefs.task_assignment === false) return;

  // Get case info
  const { data: caseData } = await db
    .from("cases")
    .select("ref, client_name")
    .eq("id", caseId)
    .single();

  const caseName = caseData?.client_name || caseData?.ref || caseId;
  const dueStr = task.due_date ? `<br>📅 Due: <strong>${task.due_date}</strong>` : "";
  const priorityLabel = task.priority === "high" ? "🔴 High" : task.priority === "medium" ? "🟡 Medium" : "⚪ Normal";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#000066;color:#ebb003;padding:16px 20px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;font-size:18px">📋 New Task Assigned</h2>
      </div>
      <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 12px 12px;color:#333">
        <p>Hi <strong>${member.name}</strong>,</p>
        <p>You've been assigned a new task:</p>
        <div style="background:#f8f9fa;border-left:4px solid #ebb003;padding:16px;margin:16px 0;border-radius:0 8px 8px 0">
          <strong style="font-size:16px">${task.title || "Untitled Task"}</strong><br>
          📁 Case: <strong>${caseName}</strong><br>
          🏷️ Priority: ${priorityLabel}${dueStr}
        </div>
        ${task.description ? `<p style="color:#555">${task.description}</p>` : ""}
        <a href="https://denham-cms.vercel.app/cases/${caseId}" style="display:inline-block;background:#000066;color:#ebb003;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          View Case →
        </a>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#999">Denham CMS — Task Notification</p>
      </div>
    </div>`;

  await sendEmail({
    to: member.email,
    subject: `📋 Task Assigned: ${task.title || "New Task"} — ${caseName}`,
    htmlBody: html,
  });
}
