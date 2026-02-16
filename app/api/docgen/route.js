import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM";

const supabase = createClient(supabaseUrl, supabaseKey);

const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `[${key}]`);
}

const TEMPLATES = {
  demand_letter: {
    name: "Demand Letter",
    generate: (c, cd, ld, negs, ests) => {
      const highEst = ests.reduce((max, e) => Math.max(max, Number(e.amount) || 0), 0);
      return fillTemplate(
`{{date}}

VIA CERTIFIED MAIL

{{adjuster}}
{{insurer}}

Re: {{clientName}}
    Claim Number: {{claimNumber}}
    Policy Number: {{policyNumber}}
    Date of Loss: {{dateOfLoss}}

Dear {{adjuster}}:

This firm represents {{clientName}} in connection with the above-referenced claim for property damage sustained on {{dateOfLoss}} at {{propertyAddress}}.

FACTS OF LOSS:

On {{dateOfLoss}}, our client's property sustained significant damage due to {{causeOfLoss}}. The damage was reported to your company and assigned claim number {{claimNumber}}.

DAMAGES:

Based on our investigation and the estimates obtained, the total damages to our client's property are as follows:

Total Estimated Damages: {{totalDamages}}

DEMAND:

Based on the foregoing, we hereby demand payment in the amount of {{totalDamages}} within thirty (30) days of receipt of this letter. Failure to respond may result in the filing of a lawsuit to protect our client's interests.

Please direct all future correspondence regarding this matter to our office.

Sincerely,

DENHAM LAW
859-900-BART
denham.law`, {
          date: today(),
          adjuster: cd?.adjuster_name || "[ADJUSTER NAME]",
          insurer: c.insurer || "[INSURER]",
          clientName: c.client_name,
          claimNumber: cd?.claim_number || c.claim_number || "[CLAIM #]",
          policyNumber: cd?.policy_number || c.policy_number || "[POLICY #]",
          dateOfLoss: c.date_of_loss ? new Date(c.date_of_loss + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "[DATE]",
          propertyAddress: cd?.property_address || "[PROPERTY ADDRESS]",
          causeOfLoss: cd?.cause_of_loss || "[CAUSE OF LOSS]",
          totalDamages: highEst > 0 ? "$" + highEst.toLocaleString("en-US") : "[AMOUNT]",
        });
    },
  },

  complaint: {
    name: "Complaint",
    generate: (c, cd, ld) => fillTemplate(
`IN THE {{court}} COURT
{{jurisdiction}} COUNTY, {{state}}

{{clientName}},
    Plaintiff,
                                    Civil Action No. ____________
v.

{{insurer}},
    Defendant.

COMPLAINT

Comes now the Plaintiff, {{clientName}}, by and through undersigned counsel, and for their Complaint against the Defendant, {{insurer}}, states as follows:

PARTIES

1. Plaintiff {{clientName}} is a resident of {{jurisdiction}}, {{state}}.

2. Defendant {{insurer}} is a corporation authorized to conduct insurance business in the State of {{state}}.

JURISDICTION AND VENUE

3. This Court has jurisdiction over this action pursuant to applicable state law.

4. Venue is proper in this Court.

FACTS

5. At all times relevant hereto, Plaintiff maintained a policy of insurance with Defendant, Policy Number {{policyNumber}}.

6. On or about {{dateOfLoss}}, Plaintiff's property located at {{propertyAddress}} sustained damage due to {{causeOfLoss}}.

7. Plaintiff timely reported the loss to Defendant under Claim Number {{claimNumber}}.

8. Despite Plaintiff's compliance with all policy conditions, Defendant has failed and refused to fully compensate Plaintiff for the covered losses.

COUNT I - BREACH OF CONTRACT

9. Plaintiff incorporates all preceding paragraphs.

10. Defendant breached the insurance contract by failing to pay the full amount of covered damages.

COUNT II - VIOLATION OF UNFAIR CLAIMS SETTLEMENT PRACTICES ACT

11. Plaintiff incorporates all preceding paragraphs.

12. Defendant violated the Unfair Claims Settlement Practices Act by failing to conduct a reasonable investigation and by undervaluing Plaintiff's claim.

PRAYER FOR RELIEF

WHEREFORE, Plaintiff prays for judgment against Defendant as follows:
a. Compensatory damages in an amount to be proven at trial;
b. Statutory penalties as allowed by law;
c. Attorney's fees and costs;
d. Pre- and post-judgment interest;
e. Such other relief as the Court deems just and proper.

Respectfully submitted,

DENHAM LAW

_________________________
Attorney for Plaintiff
859-900-BART
denham.law

Date: {{date}}`, {
      date: today(),
      clientName: c.client_name,
      insurer: c.insurer || "[INSURER]",
      jurisdiction: c.jurisdiction || "[JURISDICTION]",
      state: ({ KY: "Kentucky", TN: "Tennessee", MT: "Montana", NC: "North Carolina", TX: "Texas", CA: "California", WA: "Washington", CO: "Colorado", NY: "New York" }[c.jurisdiction]) || "[STATE]",
      court: "CIRCUIT",
      policyNumber: cd?.policy_number || c.policy_number || "[POLICY #]",
      claimNumber: cd?.claim_number || c.claim_number || "[CLAIM #]",
      dateOfLoss: c.date_of_loss ? new Date(c.date_of_loss + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "[DATE]",
      propertyAddress: cd?.property_address || "[PROPERTY ADDRESS]",
      causeOfLoss: cd?.cause_of_loss || "[CAUSE OF LOSS]",
    }),
  },

  interrogatories: {
    name: "Interrogatories",
    generate: (c, cd, ld) => fillTemplate(
`IN THE CIRCUIT COURT
{{jurisdiction}} COUNTY, {{state}}

{{clientName}}, Plaintiff
v.                                          Case No. {{caseNumber}}
{{insurer}}, Defendant

PLAINTIFF'S FIRST SET OF INTERROGATORIES TO DEFENDANT

Plaintiff, {{clientName}}, by counsel, propounds the following Interrogatories to Defendant {{insurer}}, to be answered under oath within thirty (30) days:

INTERROGATORY NO. 1: Identify all persons who participated in the investigation, evaluation, or adjustment of Plaintiff's claim, including their names, titles, and dates of involvement.

INTERROGATORY NO. 2: State the total amount paid to Plaintiff under the subject policy for the claim at issue, itemizing each payment by date, amount, and purpose.

INTERROGATORY NO. 3: Identify all documents reviewed in evaluating Plaintiff's claim, including all estimates, reports, photographs, and correspondence.

INTERROGATORY NO. 4: State whether Defendant retained any independent adjusters, engineers, or experts to evaluate Plaintiff's claim. If so, identify each by name, firm, date retained, and the scope of their engagement.

INTERROGATORY NO. 5: Describe in detail the basis for Defendant's valuation of Plaintiff's claim, including all methodologies, guidelines, or software used.

INTERROGATORY NO. 6: State whether any coverage defenses have been or will be raised. If so, identify each defense and the factual basis therefor.

INTERROGATORY NO. 7: Identify all communications between Defendant and any third party regarding Plaintiff's claim.

INTERROGATORY NO. 8: State the applicable policy limits for the coverage at issue.

Respectfully submitted,

DENHAM LAW
Date: {{date}}`, {
      date: today(),
      clientName: c.client_name,
      insurer: c.insurer || "[INSURER]",
      jurisdiction: c.jurisdiction || "[JURISDICTION]",
      state: ({ KY: "Kentucky", TN: "Tennessee", MT: "Montana", NC: "North Carolina", TX: "Texas" }[c.jurisdiction]) || "[STATE]",
      caseNumber: ld?.case_number || "[CASE NO.]",
    }),
  },

  rfps: {
    name: "Requests for Production",
    generate: (c, cd, ld) => fillTemplate(
`IN THE CIRCUIT COURT
{{jurisdiction}} COUNTY, {{state}}

{{clientName}}, Plaintiff
v.                                          Case No. {{caseNumber}}
{{insurer}}, Defendant

PLAINTIFF'S FIRST REQUESTS FOR PRODUCTION OF DOCUMENTS

Plaintiff requests that Defendant produce the following documents within thirty (30) days:

REQUEST NO. 1: The complete claim file for Claim Number {{claimNumber}}, including all notes, correspondence, photographs, estimates, reports, and internal communications.

REQUEST NO. 2: The complete insurance policy, including all declarations pages, endorsements, and amendments, in effect on the date of loss.

REQUEST NO. 3: All estimates, appraisals, or repair assessments obtained or prepared regarding Plaintiff's property damage.

REQUEST NO. 4: All photographs or video of Plaintiff's property taken by Defendant or its agents.

REQUEST NO. 5: All communications between Defendant and any independent adjusters, engineers, or experts regarding Plaintiff's claim.

REQUEST NO. 6: All training materials, guidelines, or manuals used by Defendant's adjusters in evaluating property damage claims during the relevant time period.

REQUEST NO. 7: All documents relating to any prior claims made by Plaintiff under the subject policy.

REQUEST NO. 8: Defendant's underwriting file for Plaintiff's policy.

Respectfully submitted,

DENHAM LAW
Date: {{date}}`, {
      date: today(),
      clientName: c.client_name,
      insurer: c.insurer || "[INSURER]",
      jurisdiction: c.jurisdiction || "[JURISDICTION]",
      state: ({ KY: "Kentucky", TN: "Tennessee", MT: "Montana", NC: "North Carolina", TX: "Texas" }[c.jurisdiction]) || "[STATE]",
      caseNumber: ld?.case_number || "[CASE NO.]",
      claimNumber: cd?.claim_number || c.claim_number || "[CLAIM #]",
    }),
  },

  rfas: {
    name: "Requests for Admissions",
    generate: (c, cd, ld) => fillTemplate(
`IN THE CIRCUIT COURT
{{jurisdiction}} COUNTY, {{state}}

{{clientName}}, Plaintiff
v.                                          Case No. {{caseNumber}}
{{insurer}}, Defendant

PLAINTIFF'S FIRST REQUESTS FOR ADMISSIONS

Plaintiff requests that Defendant admit or deny the following within thirty (30) days:

REQUEST NO. 1: Admit that Defendant issued Policy Number {{policyNumber}} to Plaintiff.

REQUEST NO. 2: Admit that the policy was in full force and effect on {{dateOfLoss}}.

REQUEST NO. 3: Admit that Plaintiff reported a claim under the policy on or about the date of loss.

REQUEST NO. 4: Admit that Defendant assigned Claim Number {{claimNumber}} to Plaintiff's claim.

REQUEST NO. 5: Admit that Plaintiff's property sustained damage on {{dateOfLoss}}.

REQUEST NO. 6: Admit that the cause of loss — {{causeOfLoss}} — is a covered peril under the policy.

REQUEST NO. 7: Admit that Defendant conducted an inspection of Plaintiff's property.

REQUEST NO. 8: Admit that Defendant's initial estimate was less than the estimates obtained by Plaintiff's independent contractors.

Respectfully submitted,

DENHAM LAW
Date: {{date}}`, {
      date: today(),
      clientName: c.client_name,
      insurer: c.insurer || "[INSURER]",
      jurisdiction: c.jurisdiction || "[JURISDICTION]",
      state: ({ KY: "Kentucky", TN: "Tennessee" }[c.jurisdiction]) || "[STATE]",
      caseNumber: ld?.case_number || "[CASE NO.]",
      policyNumber: cd?.policy_number || c.policy_number || "[POLICY #]",
      claimNumber: cd?.claim_number || c.claim_number || "[CLAIM #]",
      dateOfLoss: c.date_of_loss ? new Date(c.date_of_loss + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "[DATE]",
      causeOfLoss: cd?.cause_of_loss || "[CAUSE OF LOSS]",
    }),
  },

  retainer: {
    name: "Retainer Agreement",
    generate: (c) => fillTemplate(
`ATTORNEY-CLIENT RETAINER AGREEMENT

This Agreement is entered into on {{date}} between:

CLIENT: {{clientName}}
       {{clientPhone}}
       {{clientEmail}}

ATTORNEY: DENHAM LAW
          859-900-BART
          denham.law

1. SCOPE OF REPRESENTATION

Attorney agrees to represent Client in connection with an insurance property damage claim arising from a loss on {{dateOfLoss}}, involving {{insurer}}, Claim Number {{claimNumber}}.

2. CONTINGENCY FEE

Client agrees to pay Attorney a contingency fee as follows:
- 33 1/3% of gross recovery if resolved before litigation is filed
- 40% of gross recovery if litigation is filed
- 45% of gross recovery if the case proceeds to trial or arbitration

3. COSTS AND EXPENSES

Client authorizes Attorney to advance costs and expenses necessary for the prosecution of the claim. Such costs shall be reimbursed from any recovery.

4. CLIENT OBLIGATIONS

Client agrees to cooperate fully, provide all requested documentation, and promptly communicate any developments related to the claim.

5. TERMINATION

Either party may terminate this agreement upon written notice. If Client terminates, Attorney shall be entitled to reasonable compensation for services rendered.

6. AUTHORIZATION

Client authorizes Attorney to communicate with {{insurer}} and all relevant parties on Client's behalf.

AGREED AND ACCEPTED:

_________________________          _________________________
{{clientName}}                     DENHAM LAW
Client                             Attorney

Date: ___________________          Date: ___________________`, {
      date: today(),
      clientName: c.client_name,
      clientPhone: c.client_phone || "[PHONE]",
      clientEmail: c.client_email || "[EMAIL]",
      dateOfLoss: c.date_of_loss ? new Date(c.date_of_loss + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "[DATE]",
      insurer: c.insurer || "[INSURER]",
      claimNumber: c.claim_number || "[CLAIM #]",
    }),
  },
};

export async function GET() {
  return Response.json({
    templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, name: t.name })),
  });
}

export async function POST(request) {
  try {
    const { caseId, template } = await request.json();

    if (!caseId || !template) {
      return Response.json({ error: "caseId and template are required" }, { status: 400 });
    }

    if (!TEMPLATES[template]) {
      return Response.json({ error: `Unknown template: ${template}. Available: ${Object.keys(TEMPLATES).join(", ")}` }, { status: 400 });
    }

    const { data: c, error } = await supabase
      .from("cases")
      .select(`
        *, claim_details(*), litigation_details(*),
        negotiations(*), estimates(*)
      `)
      .eq("id", caseId)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const cd = Array.isArray(c.claim_details) ? c.claim_details[0] : c.claim_details;
    const ld = Array.isArray(c.litigation_details) ? c.litigation_details[0] : c.litigation_details;
    const negs = c.negotiations || [];
    const ests = c.estimates || [];

    const content = TEMPLATES[template].generate(c, cd, ld, negs, ests);

    return Response.json({
      template: template,
      templateName: TEMPLATES[template].name,
      caseRef: c.ref,
      client: c.client_name,
      content,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
