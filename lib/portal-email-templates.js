// Professional law firm email templates for client portal notifications
// Tone: warm, professional, reassuring — these are injury/property damage clients

const FIRM_NAME = "Bart Denham Law";
const FIRM_PHONE = "(502) 324-1505";
const FIRM_EMAIL = "bart@bartdenhamlaw.com";
const PORTAL_URL = "https://denham-cms.vercel.app/portal";

function baseTemplate(content, preheader = "") {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f4f4f8; font-family: Georgia, 'Times New Roman', serif; }
  .container { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#000066; padding:28px 32px; text-align:center; }
  .header h1 { color:#ebb003; margin:0; font-size:22px; font-weight:700; letter-spacing:0.5px; }
  .header p { color:#c0c0d0; margin:4px 0 0; font-size:12px; }
  .body { padding:32px; color:#1a1a2e; line-height:1.7; font-size:15px; }
  .body h2 { color:#000066; font-size:18px; margin:0 0 16px; }
  .body p { margin:0 0 14px; }
  .highlight-box { background:#f0f0ff; border-left:4px solid #000066; padding:16px 20px; margin:20px 0; border-radius:0 6px 6px 0; }
  .highlight-box strong { color:#000066; }
  .cta-btn { display:inline-block; background:#000066; color:#ffffff !important; padding:12px 28px; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px; margin:16px 0; }
  .footer { background:#f4f4f8; padding:24px 32px; text-align:center; font-size:12px; color:#666; border-top:1px solid #e0e0e8; }
  .footer a { color:#000066; }
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ""}
<div class="container">
  <div class="header">
    <h1>${FIRM_NAME}</h1>
    <p>Client Portal Update</p>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p><strong>${FIRM_NAME}</strong><br>
    ${FIRM_PHONE} · <a href="mailto:${FIRM_EMAIL}">${FIRM_EMAIL}</a></p>
    <p style="margin-top:12px;font-size:11px;color:#999;">
      This is an automated notification from your client portal. 
      If you have questions, please don't hesitate to contact our office.
    </p>
  </div>
</div>
</body>
</html>`;
}

export function phaseChangeEmail(clientName, caseName, newPhase, explanation) {
  const phaseDescriptions = {
    "Intake": "We are gathering initial information about your case.",
    "Investigation": "We are actively investigating the details and gathering evidence.",
    "Pre-Suit": "We are preparing your claim and working toward a resolution before filing suit.",
    "Demand": "We have sent a demand to the opposing party on your behalf.",
    "Negotiation": "We are actively negotiating with the other side to reach a fair settlement.",
    "Litigation": "Your case has been filed in court. We will keep you updated on all developments.",
    "Discovery": "Both sides are exchanging information and evidence as part of the legal process.",
    "Mediation": "We are participating in mediation to try to resolve your case.",
    "Trial Prep": "We are preparing for trial to present your case to a judge or jury.",
    "Trial": "Your case is going to trial. We will be in close contact with you.",
    "Settlement": "We are finalizing a settlement agreement.",
    "Closed": "Your case has been resolved. Thank you for trusting us with your matter.",
  };

  const desc = explanation || phaseDescriptions[newPhase] || "Our team is actively working on your case.";

  const content = `
    <h2>Case Update: New Phase</h2>
    <p>Dear ${clientName || "Valued Client"},</p>
    <p>We wanted to let you know that your case has progressed to a new phase:</p>
    <div class="highlight-box">
      <strong>Current Phase: ${newPhase}</strong><br>
      ${desc}
    </div>
    <p>This is a positive step in the process. Our team continues to work diligently on your behalf, and we are committed to achieving the best possible outcome for you.</p>
    <p>If you have any questions about what this means for your case, please don't hesitate to reach out to our office.</p>
    <a href="${PORTAL_URL}" class="cta-btn">View Your Case Portal</a>
    <p>Warm regards,<br><strong>${FIRM_NAME}</strong></p>
  `;

  return {
    subject: `Case Update: Your case has moved to ${newPhase}`,
    html: baseTemplate(content, `Your case with ${FIRM_NAME} has progressed to ${newPhase}.`),
  };
}

export function documentUploadedEmail(clientName, documentName, uploadedBy) {
  const content = `
    <h2>New Document Available</h2>
    <p>Dear ${clientName || "Valued Client"},</p>
    <p>A new document has been added to your case file and is now available for you to review in your client portal:</p>
    <div class="highlight-box">
      <strong>Document: ${documentName || "New File"}</strong>
      ${uploadedBy ? `<br>Uploaded by: ${uploadedBy}` : ""}
    </div>
    <p>You can view and download this document by logging into your client portal.</p>
    <a href="${PORTAL_URL}" class="cta-btn">View Document in Portal</a>
    <p>If you have any questions about this document, please contact our office.</p>
    <p>Warm regards,<br><strong>${FIRM_NAME}</strong></p>
  `;

  return {
    subject: `New Document Available — ${documentName || "Case Update"}`,
    html: baseTemplate(content, `A new document is available in your ${FIRM_NAME} client portal.`),
  };
}

export function taskMilestoneEmail(clientName, milestoneName, description) {
  const content = `
    <h2>Progress Update</h2>
    <p>Dear ${clientName || "Valued Client"},</p>
    <p>We're pleased to let you know that an important milestone has been reached in your case:</p>
    <div class="highlight-box">
      <strong>${milestoneName}</strong>
      ${description ? `<br>${description}` : ""}
    </div>
    <p>We understand that the legal process can feel slow at times, but please know that our team is working hard to move your case forward as efficiently as possible.</p>
    <a href="${PORTAL_URL}" class="cta-btn">Check Your Case Status</a>
    <p>As always, if you have questions or concerns, we are here for you.</p>
    <p>Warm regards,<br><strong>${FIRM_NAME}</strong></p>
  `;

  return {
    subject: `Case Progress: ${milestoneName}`,
    html: baseTemplate(content, `A milestone has been completed on your case: ${milestoneName}`),
  };
}

export function generalNotificationEmail(clientName, subject, messageBody) {
  const content = `
    <h2>${subject}</h2>
    <p>Dear ${clientName || "Valued Client"},</p>
    <p>${messageBody}</p>
    <a href="${PORTAL_URL}" class="cta-btn">Visit Your Portal</a>
    <p>Warm regards,<br><strong>${FIRM_NAME}</strong></p>
  `;

  return {
    subject,
    html: baseTemplate(content),
  };
}

export function appointmentReminderEmail(clientName, date, time, location) {
  const content = `
    <h2>Appointment Reminder</h2>
    <p>Dear ${clientName || "Valued Client"},</p>
    <p>This is a friendly reminder about your upcoming appointment:</p>
    <div class="highlight-box">
      <strong>Date:</strong> ${date}<br>
      <strong>Time:</strong> ${time}<br>
      ${location ? `<strong>Location:</strong> ${location}` : ""}
    </div>
    <p>If you need to reschedule, please contact our office as soon as possible at ${FIRM_PHONE}.</p>
    <p>We look forward to seeing you.</p>
    <p>Warm regards,<br><strong>${FIRM_NAME}</strong></p>
  `;

  return {
    subject: `Appointment Reminder — ${date} at ${time}`,
    html: baseTemplate(content, `Reminder: You have an appointment with ${FIRM_NAME} on ${date}.`),
  };
}
