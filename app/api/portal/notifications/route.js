import { supabaseAdmin, supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/send-email";
import {
  phaseChangeEmail,
  documentUploadedEmail,
  taskMilestoneEmail,
  generalNotificationEmail,
  appointmentReminderEmail,
} from "@/lib/portal-email-templates";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

// GET: List notification history for a case
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("case_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!caseId) {
      return NextResponse.json({ error: "case_id required" }, { status: 400 });
    }

    const { data, error, count } = await db
      .from("portal_notifications")
      .select("*", { count: "exact" })
      .eq("case_id", caseId)
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ notifications: data || [], total: count || 0 });
  } catch (err) {
    console.error("Notification list error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Send notification email to client
// Body: { case_id, type, client_email?, client_name?, ...type-specific fields }
// Types: phase_change, document_uploaded, task_milestone, general, appointment_reminder
export async function POST(request) {
  try {
    const body = await request.json();
    const { case_id, type = "general", client_email, client_name, ...params } = body;

    if (!case_id) {
      return NextResponse.json({ error: "case_id required" }, { status: 400 });
    }

    // Check if notifications are enabled for this case
    const { data: caseData } = await db
      .from("cases")
      .select("id, client, portal_notifications_enabled, portal_email")
      .eq("id", case_id)
      .single();

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (caseData.portal_notifications_enabled === false) {
      return NextResponse.json({ skipped: true, reason: "Notifications disabled for this case" });
    }

    // Resolve client email
    const email = client_email || caseData.portal_email;
    if (!email) {
      // Log the notification anyway but mark as failed
      await db.from("portal_notifications").insert({
        case_id,
        type,
        subject: "Notification attempted",
        body: JSON.stringify(params),
        status: "failed",
        error_message: "No client email on file",
      });
      return NextResponse.json({ error: "No client email configured for this case" }, { status: 400 });
    }

    const name = client_name || caseData.client || "Valued Client";

    // Generate email based on type
    let emailContent;
    switch (type) {
      case "phase_change":
        emailContent = phaseChangeEmail(name, null, params.new_phase, params.explanation);
        break;
      case "document_uploaded":
        emailContent = documentUploadedEmail(name, params.document_name, params.uploaded_by);
        break;
      case "task_milestone":
        emailContent = taskMilestoneEmail(name, params.milestone_name, params.description);
        break;
      case "appointment_reminder":
        emailContent = appointmentReminderEmail(name, params.date, params.time, params.location);
        break;
      case "general":
      default:
        emailContent = generalNotificationEmail(name, params.subject || "Case Update", params.message || params.body || "");
        break;
    }

    // Record the notification
    const notifRecord = {
      case_id,
      type,
      subject: emailContent.subject,
      body: emailContent.html,
      sent_to: email,
      status: "sending",
    };

    const { data: notif, error: insertErr } = await db
      .from("portal_notifications")
      .insert(notifRecord)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Send the email
    try {
      await sendEmail({
        to: email,
        subject: emailContent.subject,
        htmlBody: emailContent.html,
      });

      await db
        .from("portal_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", notif.id);

      return NextResponse.json({
        success: true,
        notification_id: notif.id,
        sent_to: email,
        subject: emailContent.subject,
      });
    } catch (sendErr) {
      await db
        .from("portal_notifications")
        .update({ status: "failed", error_message: sendErr.message })
        .eq("id", notif.id);

      return NextResponse.json({
        error: "Email send failed",
        detail: sendErr.message,
        notification_id: notif.id,
      }, { status: 500 });
    }
  } catch (err) {
    console.error("Portal notification error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
