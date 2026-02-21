import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/send-email";
import { NextResponse } from "next/server";

const db = supabaseAdmin;

// Cron-compatible: GET /api/notifications/daily-digest
// Finds tasks due today/tomorrow, overdue tasks, and stale cases — emails each team member their summary
export async function GET(request) {
  try {
    // Verify cron secret if configured
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

    // Get all team members with email
    const { data: members } = await db
      .from("team_members")
      .select("id, name, email, notification_preferences");

    if (!members?.length) {
      return NextResponse.json({ message: "No team members found" });
    }

    // Get all open tasks with due dates
    const { data: allTasks } = await db
      .from("case_tasks")
      .select("id, title, due_date, status, priority, assigned_to, case_id, cases(ref, client_name)")
      .not("status", "eq", "completed")
      .not("status", "eq", "cancelled");

    const tasks = allTasks || [];

    // Get stale cases
    let staleCases = [];
    try {
      const staleRes = await fetch(new URL("/api/cases/stale", request.url).toString());
      const staleData = await staleRes.json();
      staleCases = staleData.stale_cases || [];
    } catch { /* stale endpoint may not exist yet */ }

    const results = [];

    for (const member of members) {
      if (!member.email) continue;

      const prefs = member.notification_preferences || {};
      if (prefs.email_enabled === false || prefs.daily_digest === false) continue;

      // Tasks assigned to this member
      const myTasks = tasks.filter(t => t.assigned_to === member.id);

      const overdue = myTasks.filter(t => t.due_date && t.due_date < today);
      const dueToday = myTasks.filter(t => t.due_date === today);
      const dueTomorrow = myTasks.filter(t => t.due_date === tomorrow);

      // Stale cases for this member (by attorney_id)
      const myStale = staleCases.filter(c => c.attorney_id === member.id);

      // Skip if nothing to report
      if (!overdue.length && !dueToday.length && !dueTomorrow.length && !myStale.length) {
        results.push({ member: member.name, skipped: true, reason: "nothing to report" });
        continue;
      }

      const html = buildDigestHtml({
        name: member.name,
        overdue,
        dueToday,
        dueTomorrow,
        staleCases: myStale,
        date: today,
      });

      try {
        await sendEmail({
          to: member.email,
          subject: `📋 Daily Digest — ${today}`,
          htmlBody: html,
        });
        results.push({ member: member.name, sent: true });
      } catch (err) {
        results.push({ member: member.name, error: err.message });
      }
    }

    return NextResponse.json({ results, date: today });
  } catch (err) {
    console.error("Daily digest error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function buildDigestHtml({ name, overdue, dueToday, dueTomorrow, staleCases, date }) {
  const taskRow = (t) => {
    const caseName = t.cases?.client_name || t.cases?.ref || "";
    const priority = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${priority} ${t.title}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${caseName}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${t.due_date || "No date"}</td>
    </tr>`;
  };

  const taskTable = (tasks, title, color) => {
    if (!tasks.length) return "";
    return `
      <h3 style="color:${color};margin:20px 0 8px">${title} (${tasks.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#f5f5f5">
          <th style="padding:8px;text-align:left">Task</th>
          <th style="padding:8px;text-align:left">Case</th>
          <th style="padding:8px;text-align:left">Due</th>
        </tr>
        ${tasks.map(taskRow).join("")}
      </table>`;
  };

  const staleSection = staleCases.length ? `
    <h3 style="color:#e65100;margin:20px 0 8px">⚠️ Needs Attention — Stale Cases (${staleCases.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left">Case</th>
        <th style="padding:8px;text-align:left">Status</th>
        <th style="padding:8px;text-align:left">Days Inactive</th>
      </tr>
      ${staleCases.map(c => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${c.client_name} (${c.ref || ""})</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${c.status}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#e53935;font-weight:600">${c.days_since_activity}d</td>
      </tr>`).join("")}
    </table>` : "";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:700px;margin:0 auto;padding:20px">
      <div style="background:#000066;color:#ebb003;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:22px">Denham Law — Daily Digest</h1>
        <p style="margin:4px 0 0;color:#ccc;font-size:13px">${date}</p>
      </div>
      <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 12px 12px;color:#333">
        <p style="font-size:16px">Good morning, <strong>${name}</strong>!</p>
        ${taskTable(overdue, "🚨 Overdue Tasks", "#e53935")}
        ${taskTable(dueToday, "📌 Due Today", "#e65100")}
        ${taskTable(dueTomorrow, "📅 Due Tomorrow", "#1565c0")}
        ${staleSection}
        ${!overdue.length && !dueToday.length && !dueTomorrow.length && !staleCases.length
          ? "<p style='color:#4caf50;font-size:16px'>✅ All clear — no urgent tasks or stale cases!</p>" : ""}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#999;text-align:center">
          Denham CMS — <a href="https://denham-cms.vercel.app" style="color:#000066">Open Dashboard</a>
        </p>
      </div>
    </div>`;
}
