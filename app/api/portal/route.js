import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const { ref, lastName } = await request.json();

    if (!ref || !lastName) {
      return Response.json({ error: "Case reference and last name are required" }, { status: 400 });
    }

    // Look up case by ref + client last name
    const { data: cases, error } = await supabase
      .from("cases")
      .select(`
        id, ref, client_name, status, type, jurisdiction, insurer,
        date_of_loss, date_opened, statute_of_limitations,
        attorney:team_members!cases_attorney_id_fkey(name),
        claim_details(date_of_loss, cause_of_loss, property_address),
        litigation_details(case_number, court, filed_date, trial_date, mediation_date),
        activity_log(date, type, title)
      `)
      .ilike("ref", ref.trim())
      .ilike("client_name", `%${lastName.trim()}%`);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!cases || cases.length === 0) {
      return Response.json({ error: "No case found. Please check your reference number and last name." }, { status: 404 });
    }

    const c = cases[0];
    const cd = Array.isArray(c.claim_details) ? c.claim_details[0] : c.claim_details;
    const ld = Array.isArray(c.litigation_details) ? c.litigation_details[0] : c.litigation_details;

    // Build timeline from activity log (exclude internal notes)
    const timeline = (c.activity_log || [])
      .filter(a => !["note"].includes(a.type))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20)
      .map(a => ({ date: a.date, type: a.type, title: a.title }));

    // Status progression
    const statusOrder = ["Presuit", "Presuit", "Presuit", "Presuit",
      "Litigation - Filed", "Litigation - Discovery", "Litigation - Mediation",
      "Litigation - Trial Prep", "Appraisal", "Settled", "Closed"];
    const currentIdx = statusOrder.indexOf(c.status);

    // Next steps based on status
    const nextSteps = [];
    if (c.status === "Presuit") nextSteps.push("Your case is being evaluated. We will contact you with next steps.");
    if (c.status === "Presuit") nextSteps.push("We are gathering evidence and documentation for your claim.");
    if (c.status === "Presuit") nextSteps.push("A demand has been sent to the insurance company. Awaiting their response.");
    if (c.status === "Presuit") nextSteps.push("We are actively negotiating with the insurance company on your behalf.");
    if (c.status?.startsWith("Litigation")) nextSteps.push("Your case is in active litigation. Your attorney will keep you updated on proceedings.");
    if (c.status === "Appraisal") nextSteps.push("Your claim is in the appraisal process.");
    if (c.status === "Settled") nextSteps.push("Your case has been settled. Disbursement details will be provided.");

    return Response.json({
      case: {
        id: c.id,
        ref: c.ref,
        client: c.client_name,
        status: c.status,
        statusProgress: currentIdx >= 0 ? Math.round((currentIdx / (statusOrder.length - 1)) * 100) : 0,
        type: c.type,
        jurisdiction: c.jurisdiction,
        insurer: c.insurer,
        dateOfLoss: c.date_of_loss,
        dateOpened: c.date_opened,
        attorney: c.attorney?.name || "To be assigned",
        propertyAddress: cd?.property_address || null,
        causeOfLoss: cd?.cause_of_loss || null,
        inLitigation: c.status?.startsWith("Litigation") || false,
        courtCase: ld?.case_number || null,
        court: ld?.court || null,
        trialDate: ld?.trial_date || null,
        nextSteps,
        timeline,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

