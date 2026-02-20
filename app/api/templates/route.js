import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const FIRM = {
  name: "Denham Property and Injury Law Firm",
  address: "250 W. Main St. Suite 120",
  city: "Lexington, KY 40507",
  phone: "(859) 900-2278",
  attorney: "Bart Denham, Esq.",
};

const TEMPLATES = [
  {
    id: "demand-letter",
    name: "Demand Letter",
    description: "Formal demand to insurer with case details, damages, and policy information",
    icon: "⚖️",
    category: "Litigation",
  },
  {
    id: "representation-letter",
    name: "Representation Letter",
    description: "Letter to insurer establishing attorney-client relationship",
    icon: "📋",
    category: "Presuit",
  },
  {
    id: "status-update-client",
    name: "Status Update (Client)",
    description: "Letter to client updating case status",
    icon: "📬",
    category: "Client Communication",
  },
  {
    id: "preservation-letter",
    name: "Preservation Letter",
    description: "Spoliation/preservation demand to insurer",
    icon: "🔒",
    category: "Litigation",
  },
  {
    id: "pi-demand-letter",
    name: "Personal Injury Demand Letter",
    description: "Comprehensive PI demand letter with liability, medical treatment, and damages",
    icon: "🩹",
    category: "Personal Injury",
  },
  {
    id: "authorization-release",
    name: "Authorization Release",
    description: "Medical/property records release form",
    icon: "📝",
    category: "Records",
  },
  {
    id: "complaint",
    name: "Complaint",
    description: "Civil complaint / petition for breach of insurance contract",
    icon: "📜",
    category: "Litigation",
  },
  {
    id: "discovery-requests",
    name: "Discovery Requests",
    description: "Interrogatories and requests for production to insurer",
    icon: "🔍",
    category: "Litigation",
  },
];

function formatDate(d) {
  if (!d) return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function letterhead() {
  return `
    <div style="text-align:center;border-bottom:3px double #000066;padding-bottom:16px;margin-bottom:24px;">
      <div style="font-size:22px;font-weight:bold;color:#000066;letter-spacing:1px;">${FIRM.name}</div>
      <div style="font-size:13px;color:#444;margin-top:4px;">${FIRM.address} | ${FIRM.city}</div>
      <div style="font-size:13px;color:#444;">Phone: ${FIRM.phone}</div>
    </div>`;
}

function signatureBlock() {
  return `
    <div style="margin-top:48px;">
      <div>Sincerely,</div>
      <div style="margin-top:48px;border-top:1px solid #000;width:250px;padding-top:4px;">
        <div style="font-weight:bold;">${FIRM.attorney}</div>
        <div style="font-size:13px;color:#444;">${FIRM.name}</div>
        <div style="font-size:13px;color:#444;">${FIRM.address}, ${FIRM.city}</div>
        <div style="font-size:13px;color:#444;">Phone: ${FIRM.phone}</div>
      </div>
    </div>`;
}

function wrap(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @media print { body { margin: 0.75in 1in; } }
    body { font-family: 'Times New Roman', Georgia, serif; font-size: 14px; line-height: 1.6; color: #111; max-width: 8.5in; margin: 0 auto; padding: 40px; }
    p { margin: 0 0 12px 0; }
  </style></head><body>${letterhead()}${body}${signatureBlock()}</body></html>`;
}

function v(val, fallback = "[N/A]") { return val || fallback; }

function generateDemandLetter(c) {
  const claim = c.claim_details || {};
  const totalDamages = (parseFloat(claim.property_damage) || 0) + (parseFloat(claim.medical_expenses) || 0) + (parseFloat(claim.lost_wages) || 0) + (parseFloat(claim.other_damages) || 0);
  const body = `
    <div style="margin-bottom:24px;">${formatDate()}</div>
    <div style="margin-bottom:4px;">${v(c.insurer, "[Insurance Company]")}</div>
    <div style="margin-bottom:4px;">Attn: ${v(c.adjuster_name, "[Claims Adjuster]")}</div>
    <div style="margin-bottom:24px;">&nbsp;</div>
    <div style="margin-bottom:24px;"><strong>Re: ${v(c.client_name)} — Claim No. ${v(c.claim_number)} — Policy No. ${v(c.policy_number)} — Date of Loss: ${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}</strong></div>
    <p>Dear Claims Department:</p>
    <p>This firm represents <strong>${v(c.client_name)}</strong> in connection with the above-referenced claim arising from the ${v(c.type, "loss").toLowerCase()} that occurred on <strong>${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}</strong> at ${v(c.property_address, "[property address]")}.</p>
    <p>The cause of this loss has been identified as <strong>${v(c.cause_of_loss, "[cause of loss]")}</strong>. Our client's property sustained significant damage as a result.</p>
    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">Summary of Damages</h3>
    <table style="width:100%;border-collapse:collapse;margin:12px 0 24px 0;">
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Property Damage</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${(parseFloat(claim.property_damage) || 0).toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Medical Expenses</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${(parseFloat(claim.medical_expenses) || 0).toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Lost Wages</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${(parseFloat(claim.lost_wages) || 0).toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Other Damages</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${(parseFloat(claim.other_damages) || 0).toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr style="font-weight:bold;"><td style="padding:6px 12px;border-top:2px solid #000;">Total</td><td style="padding:6px 12px;border-top:2px solid #000;text-align:right;">$${totalDamages.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
    </table>
    <p>We hereby demand payment in the amount of <strong>$${totalDamages.toLocaleString("en-US", {minimumFractionDigits:2})}</strong> to fully and fairly compensate our client for the damages sustained. This demand is made pursuant to the terms and conditions of policy number <strong>${v(c.policy_number)}</strong>.</p>
    <p>Please respond to this demand within <strong>thirty (30) days</strong> of receipt. Failure to respond or to make a good-faith offer may result in further legal action, including but not limited to filing suit and seeking additional damages for bad faith claims handling.</p>
    <p>All future correspondence regarding this matter should be directed to this office.</p>`;
  return wrap(body);
}

function generateRepresentationLetter(c) {
  const body = `
    <div style="margin-bottom:24px;">${formatDate()}</div>
    <div style="margin-bottom:4px;">${v(c.insurer, "[Insurance Company]")}</div>
    <div style="margin-bottom:4px;">Attn: ${v(c.adjuster_name, "Claims Department")}</div>
    <div style="margin-bottom:24px;">&nbsp;</div>
    <div style="margin-bottom:24px;"><strong>Re: Letter of Representation — ${v(c.client_name)} — Claim No. ${v(c.claim_number)} — Policy No. ${v(c.policy_number)}</strong></div>
    <p>Dear Sir or Madam:</p>
    <p>Please be advised that this firm has been retained to represent <strong>${v(c.client_name)}</strong> in connection with the above-referenced insurance claim arising from a ${v(c.type, "loss").toLowerCase()} that occurred on or about <strong>${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}</strong>.</p>
    <p>Please direct all future correspondence, communications, and settlement discussions regarding this claim to the undersigned at the address listed above. <strong>Please do not contact our client directly.</strong></p>
    <p>Please forward the following to our office at your earliest convenience:</p>
    <ul>
      <li>A complete copy of the policy, including all endorsements and declarations pages</li>
      <li>All adjuster reports, field notes, and photographs</li>
      <li>All estimates, appraisals, and engineering reports</li>
      <li>Any recorded statements taken from the insured</li>
      <li>All correspondence related to this claim</li>
    </ul>
    <p>Please confirm receipt of this letter and provide your adjuster's direct contact information for this file. We look forward to working toward a prompt and fair resolution of this claim.</p>`;
  return wrap(body);
}

function generateStatusUpdateClient(c) {
  const body = `
    <div style="margin-bottom:24px;">${formatDate()}</div>
    <div style="margin-bottom:4px;">${v(c.client_name)}</div>
    ${c.client_email ? `<div style="margin-bottom:4px;">${c.client_email}</div>` : ""}
    ${c.client_phone ? `<div style="margin-bottom:4px;">${c.client_phone}</div>` : ""}
    <div style="margin-bottom:24px;">&nbsp;</div>
    <div style="margin-bottom:24px;"><strong>Re: Status Update — ${v(c.type, "Your Case")} Claim — Ref: ${v(c.ref)}</strong></div>
    <p>Dear ${v(c.client_name)}:</p>
    <p>I am writing to provide you with an update regarding your ${v(c.type, "insurance").toLowerCase()} claim${c.insurer ? ` against <strong>${c.insurer}</strong>` : ""}${c.claim_number ? ` (Claim No. ${c.claim_number})` : ""}.</p>
    <p>Your case is currently in <strong>${v(c.status, "active")}</strong> status. ${c.date_of_loss ? `The date of loss was ${formatDate(c.date_of_loss)}.` : ""}</p>
    <p><em>[Insert specific status details here — e.g., pending insurer response, estimate scheduled, negotiation underway, etc.]</em></p>
    <p>We continue to diligently pursue your claim and will keep you informed of any significant developments. If you have any questions or concerns, please do not hesitate to contact our office at ${FIRM.phone}.</p>
    <p>Thank you for your continued trust in our firm.</p>`;
  return wrap(body);
}

function generatePreservationLetter(c) {
  const body = `
    <div style="margin-bottom:24px;">${formatDate()}</div>
    <div style="margin-bottom:4px;"><strong>VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED</strong></div>
    <div style="margin-bottom:4px;">&nbsp;</div>
    <div style="margin-bottom:4px;">${v(c.insurer, "[Insurance Company]")}</div>
    <div style="margin-bottom:4px;">Attn: ${v(c.adjuster_name, "Claims Department / Legal Department")}</div>
    <div style="margin-bottom:24px;">&nbsp;</div>
    <div style="margin-bottom:24px;"><strong>Re: Preservation of Evidence — ${v(c.client_name)} — Claim No. ${v(c.claim_number)} — Date of Loss: ${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}</strong></div>
    <p>Dear Sir or Madam:</p>
    <p>This firm represents <strong>${v(c.client_name)}</strong> in connection with the above-referenced claim. This letter serves as formal notice of your obligation to <strong>preserve all evidence</strong> related to this matter.</p>
    <p>You are hereby directed to preserve, and to refrain from destroying, altering, concealing, or otherwise disposing of, the following categories of evidence:</p>
    <ol>
      <li>All claim files, notes, logs, diaries, and internal memoranda relating to this claim</li>
      <li>All photographs, video recordings, and inspection reports of the insured property</li>
      <li>All estimates, appraisals, engineering reports, and expert evaluations</li>
      <li>All electronically stored information (ESI), including emails, text messages, and electronic communications</li>
      <li>All recorded or written statements obtained from the insured, witnesses, or third parties</li>
      <li>All policy documents, endorsements, and underwriting files</li>
      <li>All financial records related to payments, reserves, and valuations for this claim</li>
      <li>Any and all documents or tangible items related in any way to this claim</li>
    </ol>
    <p>This preservation obligation is ongoing and applies to all persons, departments, and agents within your organization who may have possession, custody, or control of relevant evidence.</p>
    <p><strong>Failure to preserve evidence may result in claims of spoliation and requests for adverse inference instructions, sanctions, or other appropriate remedies.</strong></p>
    <p>Please confirm receipt of this letter and your compliance with this preservation directive in writing within <strong>ten (10) days</strong>.</p>`;
  return wrap(body);
}

function generateAuthorizationRelease(c) {
  const body = `
    <div style="text-align:center;margin-bottom:32px;">
      <h2 style="color:#000066;margin:0;">AUTHORIZATION FOR RELEASE OF RECORDS</h2>
    </div>
    <div style="margin-bottom:24px;">${formatDate()}</div>
    <div style="margin-bottom:24px;"><strong>Re: ${v(c.client_name)} — Ref: ${v(c.ref)}</strong></div>
    <p>I, <strong>${v(c.client_name)}</strong>, hereby authorize any physician, hospital, clinic, medical facility, pharmacy, insurance company, employer, government agency, or other entity to release to <strong>${FIRM.name}</strong> any and all records, reports, documents, or information pertaining to:</p>
    <ul>
      <li>Medical records, including but not limited to office notes, diagnostic imaging, laboratory results, treatment records, and billing statements</li>
      <li>Property records, including inspection reports, repair estimates, and related documentation</li>
      <li>Employment records, including wage and salary information, attendance records, and benefits information</li>
      <li>Insurance records, including policy information, claim files, and correspondence</li>
    </ul>
    <p>This authorization covers the period from <strong>${c.date_of_loss ? formatDate(c.date_of_loss) : "[Date of Loss]"}</strong> to the present date, and any prior records as may be relevant to the above-referenced matter.</p>
    <p>This authorization shall remain in effect until revoked in writing. A photocopy or facsimile of this authorization shall be as valid as the original.</p>
    <div style="margin-top:48px;">
      <div style="display:flex;gap:48px;flex-wrap:wrap;">
        <div>
          <div style="border-top:1px solid #000;width:300px;padding-top:4px;margin-top:48px;">
            <div>${v(c.client_name)}</div>
            <div style="font-size:13px;color:#444;">Signature / Date</div>
          </div>
        </div>
        <div>
          <div style="border-top:1px solid #000;width:300px;padding-top:4px;margin-top:48px;">
            <div>Witness</div>
            <div style="font-size:13px;color:#444;">Signature / Date</div>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #ccc;font-size:12px;color:#666;">
      <p>Prepared by ${FIRM.name} | ${FIRM.address}, ${FIRM.city} | ${FIRM.phone}</p>
    </div>`;
  // Authorization doesn't get the standard signature block
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @media print { body { margin: 0.75in 1in; } }
    body { font-family: 'Times New Roman', Georgia, serif; font-size: 14px; line-height: 1.6; color: #111; max-width: 8.5in; margin: 0 auto; padding: 40px; }
    p { margin: 0 0 12px 0; }
  </style></head><body>${letterhead()}${body}</body></html>`;
}

function generatePiDemandLetter(c) {
  const claim = c.claim_details || {};
  const medicalExpenses = parseFloat(claim.medical_expenses) || 0;
  const lostWages = parseFloat(claim.lost_wages) || 0;
  const otherDamages = parseFloat(claim.other_damages) || 0;
  const economicTotal = medicalExpenses + lostWages + otherDamages;
  // Default non-economic multiplier: 3x medical if no explicit amount
  const nonEconomic = parseFloat(claim.non_economic_damages) || (medicalExpenses * 3);
  const totalDemand = economicTotal + nonEconomic;

  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 30);
  const deadline = formatDate(deadlineDate);

  const body = `
    <div style="margin-bottom:24px;">${formatDate()}</div>
    <div style="margin-bottom:4px;"><strong>VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED</strong></div>
    <div style="margin-bottom:4px;">&nbsp;</div>
    <div style="margin-bottom:4px;">${v(c.insurer, "[Insurance Company]")}</div>
    <div style="margin-bottom:4px;">Attn: ${v(c.adjuster_name, "[Claims Adjuster]")}</div>
    ${c.adjuster_email ? `<div style="margin-bottom:4px;">${c.adjuster_email}</div>` : ""}
    <div style="margin-bottom:24px;">&nbsp;</div>

    <div style="margin-bottom:24px;"><strong>Re: ${v(c.client_name)} — Claim No. ${v(c.claim_number)} — Policy No. ${v(c.policy_number)} — Date of Incident: ${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}</strong></div>

    <p>Dear ${v(c.adjuster_name, "Claims Adjuster")}:</p>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">I. Representation</h3>
    <p>Please be advised that this firm represents <strong>${v(c.client_name)}</strong> in connection with a personal injury claim arising from the incident that occurred on <strong>${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}</strong>. This letter constitutes a formal demand for settlement of our client's claim against your insured.</p>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">II. Facts of the Incident &amp; Liability</h3>
    <p>On ${v(c.date_of_loss ? formatDate(c.date_of_loss) : null)}, ${v(c.client_name)} was involved in ${v(c.cause_of_loss, "[describe the incident — e.g., a motor vehicle collision at the intersection of Main St. and Broadway in Lexington, Kentucky]")}.</p>
    <p><em>[Describe the facts establishing liability — the at-fault party's negligence, traffic violations, witness statements, police report findings, etc.]</em></p>
    <p>Your insured's negligence was the sole and proximate cause of this incident and the resulting injuries to our client.</p>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">III. Injuries &amp; Medical Treatment</h3>
    <p>As a direct and proximate result of this incident, ${v(c.client_name)} sustained the following injuries:</p>
    <ul>
      <li><em>[Injury 1 — e.g., cervical strain/sprain]</em></li>
      <li><em>[Injury 2 — e.g., lumbar disc herniation at L4-L5]</em></li>
      <li><em>[Injury 3 — e.g., right shoulder rotator cuff tear]</em></li>
      <li><em>[Additional injuries as applicable]</em></li>
    </ul>

    <p><strong>Emergency Treatment:</strong></p>
    <p><em>[Describe initial ER visit, ambulance transport, hospital, date, findings]</em></p>

    <p><strong>Follow-Up Treatment &amp; Providers:</strong></p>
    <ul>
      <li><em>[Provider Name] — [type of treatment, dates, frequency]</em></li>
      <li><em>[Provider Name] — [type of treatment, dates, frequency]</em></li>
      <li><em>[Provider Name] — [type of treatment, dates, frequency]</em></li>
    </ul>

    <p><strong>Diagnostic Studies:</strong></p>
    <p><em>[MRI findings, X-ray results, CT scans, EMG/NCS results, etc.]</em></p>

    <p><strong>Current Status &amp; Prognosis:</strong></p>
    <p><em>[Describe current condition, any permanent impairment, future treatment recommendations, MMI status]</em></p>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">IV. Pain, Suffering &amp; Loss of Enjoyment of Life</h3>
    <p>${v(c.client_name)} has endured significant physical pain and emotional suffering as a result of this incident. Our client's daily life has been substantially disrupted, including:</p>
    <ul>
      <li>Chronic pain requiring ongoing treatment and medication</li>
      <li>Inability to participate in recreational activities and hobbies</li>
      <li>Difficulty performing routine daily tasks and household activities</li>
      <li>Emotional distress, anxiety, and diminished quality of life</li>
      <li>Disruption to family and social relationships</li>
    </ul>
    <p><em>[Add case-specific details about how the injuries have impacted the client's life]</em></p>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">V. Damages</h3>

    <p><strong>A. Economic Damages:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0 24px 0;">
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Medical Expenses (to date)</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${medicalExpenses.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Lost Wages / Loss of Earning Capacity</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${lostWages.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      ${otherDamages > 0 ? `<tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Other Economic Damages</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${otherDamages.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>` : ""}
      <tr style="font-weight:bold;"><td style="padding:6px 12px;border-top:2px solid #000;">Total Economic Damages</td><td style="padding:6px 12px;border-top:2px solid #000;text-align:right;">$${economicTotal.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
    </table>

    <p><strong>B. Non-Economic Damages:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0 24px 0;">
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Pain and Suffering</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;" rowspan="1">$${nonEconomic.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
    </table>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">VI. Total Demand</h3>
    <table style="width:100%;border-collapse:collapse;margin:12px 0 24px 0;">
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Economic Damages</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${economicTotal.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;">Non-Economic Damages</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;">$${nonEconomic.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
      <tr style="font-weight:bold;font-size:16px;"><td style="padding:8px 12px;border-top:3px double #000066;color:#000066;">TOTAL DEMAND</td><td style="padding:8px 12px;border-top:3px double #000066;text-align:right;color:#000066;">$${totalDemand.toLocaleString("en-US", {minimumFractionDigits:2})}</td></tr>
    </table>

    <p>Based on the foregoing, we hereby demand the total sum of <strong>$${totalDemand.toLocaleString("en-US", {minimumFractionDigits:2})}</strong> to fully and fairly compensate ${v(c.client_name)} for the injuries and damages sustained.</p>

    <h3 style="color:#000066;border-bottom:1px solid #000066;padding-bottom:4px;">VII. Settlement Deadline</h3>
    <p>This demand shall remain open for <strong>thirty (30) days</strong> from the date of this letter, through <strong>${deadline}</strong>. If we do not receive a response or a good-faith settlement offer by that date, we will have no alternative but to pursue all available legal remedies, including the filing of a civil action seeking compensatory damages, punitive damages where applicable, pre- and post-judgment interest, and attorney's fees and costs.</p>

    <p>Please direct all correspondence regarding this matter to the undersigned at the address above. We look forward to resolving this claim promptly and fairly.</p>`;
  return wrap(body);
}

function generateComplaint(c) {
  const claim = c.claim_details || {};
  const body = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:13px;margin-bottom:4px;">IN THE CIRCUIT COURT OF ${v(c.jurisdiction, "[JURISDICTION]").toUpperCase()}</div>
      <div style="font-size:13px;margin-bottom:16px;">[DIVISION]</div>
      <div style="margin-bottom:8px;"><strong>${v(c.client_name, "[PLAINTIFF]").toUpperCase()}</strong></div>
      <div style="margin-bottom:4px;">Plaintiff,</div>
      <div style="margin-bottom:8px;">v.</div>
      <div style="margin-bottom:8px;"><strong>${v(c.insurer, "[DEFENDANT INSURANCE COMPANY]").toUpperCase()}</strong></div>
      <div style="margin-bottom:8px;">Defendant.</div>
      <div style="margin-bottom:4px;">Case No. _______________</div>
    </div>
    <div style="text-align:center;margin-bottom:24px;"><h2 style="text-decoration:underline;">COMPLAINT</h2></div>
    <p>Plaintiff, <strong>${v(c.client_name)}</strong>, by and through undersigned counsel, hereby files this Complaint against Defendant, <strong>${v(c.insurer)}</strong>, and states as follows:</p>

    <h3 style="color:#000066;">I. PARTIES</h3>
    <p>1. Plaintiff ${v(c.client_name)} is an individual residing in ${v(c.jurisdiction, "[State]")}.</p>
    <p>2. Defendant ${v(c.insurer)} is an insurance company authorized to do business in the State of ${v(c.jurisdiction, "[State]")}.</p>

    <h3 style="color:#000066;">II. JURISDICTION AND VENUE</h3>
    <p>3. This Court has jurisdiction over this matter as the amount in controversy exceeds the jurisdictional minimum.</p>
    <p>4. Venue is proper in this county as the subject property is located herein and the cause of action arose in this jurisdiction.</p>

    <h3 style="color:#000066;">III. FACTUAL ALLEGATIONS</h3>
    <p>5. At all times relevant hereto, Plaintiff was the owner of real property located at ${v(c.property_address, "[property address]")}.</p>
    <p>6. At all times relevant hereto, said property was insured under a policy of insurance issued by Defendant, Policy No. ${v(c.policy_number, "[Policy Number]")}.</p>
    <p>7. On or about ${v(c.date_of_loss ? formatDate(c.date_of_loss) : "[Date of Loss]")}, the insured property sustained damage as a result of ${v(c.cause_of_loss, "[cause of loss]")}.</p>
    <p>8. Plaintiff timely reported the loss to Defendant and submitted Claim No. ${v(c.claim_number, "[Claim Number]")}.</p>
    <p>9. The damages to Plaintiff's property are covered under the terms and conditions of the policy.</p>
    <p>10. Defendant has failed and refused to pay the full amount owed under the policy.</p>

    <h3 style="color:#000066;">IV. COUNT I — BREACH OF CONTRACT</h3>
    <p>11. Plaintiff incorporates by reference the allegations set forth in paragraphs 1 through 10.</p>
    <p>12. The insurance policy constitutes a valid and binding contract between Plaintiff and Defendant.</p>
    <p>13. Plaintiff has performed all conditions precedent under the policy.</p>
    <p>14. Defendant has breached the insurance contract by failing to pay the full amount of covered damages.</p>
    <p>15. As a direct and proximate result of Defendant's breach, Plaintiff has suffered damages.</p>

    <h3 style="color:#000066;">V. COUNT II — BAD FAITH</h3>
    <p>16. Plaintiff incorporates by reference the allegations set forth above.</p>
    <p>17. Defendant's failure to properly investigate, evaluate, and pay Plaintiff's claim constitutes bad faith claims handling.</p>
    <p>18. Plaintiff is entitled to recover damages for Defendant's bad faith, including consequential damages and attorney's fees.</p>

    <h3 style="color:#000066;">PRAYER FOR RELIEF</h3>
    <p>WHEREFORE, Plaintiff respectfully requests this Court enter judgment against Defendant for:</p>
    <ol type="a">
      <li>Compensatory damages in an amount to be determined at trial;</li>
      <li>Consequential damages;</li>
      <li>Pre-judgment and post-judgment interest;</li>
      <li>Attorney's fees and costs;</li>
      <li>Such other and further relief as this Court deems just and proper.</li>
    </ol>

    <p style="margin-top:24px;"><strong>JURY DEMAND</strong></p>
    <p>Plaintiff hereby demands a trial by jury on all issues so triable.</p>`;
  return wrap(body);
}

function generateDiscoveryRequests(c) {
  const body = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:13px;margin-bottom:4px;">IN THE CIRCUIT COURT OF ${v(c.jurisdiction, "[JURISDICTION]").toUpperCase()}</div>
      <div style="margin-bottom:8px;">${v(c.client_name, "[PLAINTIFF]").toUpperCase()} v. ${v(c.insurer, "[DEFENDANT]").toUpperCase()}</div>
      <div>Case No. ${v(c.case_ref, "_______________")}</div>
    </div>

    <div style="text-align:center;margin-bottom:24px;"><h2 style="text-decoration:underline;">PLAINTIFF'S FIRST SET OF INTERROGATORIES AND<br/>REQUESTS FOR PRODUCTION OF DOCUMENTS</h2></div>

    <p>Plaintiff, <strong>${v(c.client_name)}</strong>, through undersigned counsel, propounds the following Interrogatories and Requests for Production upon Defendant <strong>${v(c.insurer)}</strong>:</p>

    <h3 style="color:#000066;">INTERROGATORIES</h3>

    <p><strong>INTERROGATORY NO. 1:</strong> Identify each person who participated in the investigation, evaluation, and adjustment of Claim No. ${v(c.claim_number, "[Claim Number]")}, including their name, title, and role.</p>

    <p><strong>INTERROGATORY NO. 2:</strong> State the total amount of all reserves set for this claim at any time, including the date each reserve was set and any subsequent changes.</p>

    <p><strong>INTERROGATORY NO. 3:</strong> Identify each estimate, appraisal, or engineering report obtained by Defendant in connection with this claim, including the name and qualifications of each estimator or engineer.</p>

    <p><strong>INTERROGATORY NO. 4:</strong> State the basis for Defendant's valuation of the claim, including the methodology used to calculate ACV and RCV.</p>

    <p><strong>INTERROGATORY NO. 5:</strong> Describe all communications between Defendant and any third-party contractor, engineer, or consultant regarding this claim.</p>

    <p><strong>INTERROGATORY NO. 6:</strong> State whether Defendant utilized any software, algorithm, or AI-based tool in evaluating this claim, and if so, identify the tool and describe how it was used.</p>

    <p><strong>INTERROGATORY NO. 7:</strong> Identify all persons with knowledge of facts relevant to the investigation and handling of this claim.</p>

    <h3 style="color:#000066;">REQUESTS FOR PRODUCTION</h3>

    <p><strong>REQUEST NO. 1:</strong> Produce the complete claim file for Claim No. ${v(c.claim_number, "[Claim Number]")}, including all notes, logs, diaries, memoranda, and correspondence.</p>

    <p><strong>REQUEST NO. 2:</strong> Produce all estimates, appraisals, and engineering reports obtained or generated in connection with this claim.</p>

    <p><strong>REQUEST NO. 3:</strong> Produce all photographs, videos, and inspection documentation of the insured property.</p>

    <p><strong>REQUEST NO. 4:</strong> Produce a complete, certified copy of the policy in effect on ${v(c.date_of_loss ? formatDate(c.date_of_loss) : "[Date of Loss]")}, including all endorsements and declarations pages.</p>

    <p><strong>REQUEST NO. 5:</strong> Produce all electronically stored information (ESI), including emails, text messages, and internal communications relating to this claim.</p>

    <p><strong>REQUEST NO. 6:</strong> Produce all training materials, claim handling guidelines, and standard operating procedures applicable to the handling of this type of claim.</p>

    <p><strong>REQUEST NO. 7:</strong> Produce all documents reflecting payments made, reserves set, or valuations calculated for this claim.</p>

    <p><strong>REQUEST NO. 8:</strong> Produce all recorded statements of the insured or any witnesses obtained in connection with this claim.</p>

    <p style="margin-top:24px;">Pursuant to the applicable Rules of Civil Procedure, Defendant shall respond to these discovery requests within <strong>thirty (30) days</strong> of service.</p>`;
  return wrap(body);
}

const GENERATORS = {
  "demand-letter": generateDemandLetter,
  "pi-demand-letter": generatePiDemandLetter,
  "representation-letter": generateRepresentationLetter,
  "status-update-client": generateStatusUpdateClient,
  "preservation-letter": generatePreservationLetter,
  "authorization-release": generateAuthorizationRelease,
  "complaint": generateComplaint,
  "discovery-requests": generateDiscoveryRequests,
};

export async function GET() {
  return NextResponse.json(TEMPLATES);
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { templateId, caseId } = await request.json();

    if (!templateId || !caseId) {
      return NextResponse.json({ error: "templateId and caseId are required" }, { status: 400 });
    }

    const generator = GENERATORS[templateId];
    if (!generator) {
      return NextResponse.json({ error: "Unknown template: " + templateId }, { status: 400 });
    }

    // Fetch case data with related info
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseError) {
      return NextResponse.json({ error: caseError.message }, { status: caseError.code === "PGRST116" ? 404 : 500 });
    }

    // Fetch claim details
    const { data: claimData } = await supabaseAdmin
      .from("claim_details")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    const fullCase = { ...caseData, claim_details: claimData || null };
    const html = generator(fullCase);

    return NextResponse.json({ html, templateId, caseId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

