import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const { query, caseId, action } = await request.json();

    // Action: summarize a specific case
    if (action === "summarize" && caseId) {
      return await summarizeCase(caseId);
    }

    // Action: smart search / natural language query
    if (action === "search" || action === "command") {
      return await handleNaturalLanguageQuery(query);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("AI API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function summarizeCase(caseId) {
  const { data: c, error } = await supabase
    .from("cases")
    .select(`
      *, attorney:team_members!cases_attorney_id_fkey(name),
      support:team_members!cases_support_id_fkey(name),
      claim_details(*), litigation_details(*),
      negotiations(*), estimates(*), pleadings(*), activity_log(*)
    `)
    .eq("id", caseId)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const sol = c.statute_of_limitations ? new Date(c.statute_of_limitations + "T00:00:00") : null;
  const solDays = sol ? Math.ceil((sol - now) / 86400000) : null;

  const negs = c.negotiations || [];
  const acts = c.activity_log || [];
  const lastActivity = acts.length > 0
    ? acts.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null;
  const daysSinceActivity = lastActivity
    ? Math.ceil((now - new Date(lastActivity.date + "T00:00:00")) / 86400000)
    : null;

  const risks = [];
  if (solDays !== null && solDays < 90) {
    risks.push({ type: "sol", severity: solDays < 30 ? "critical" : "warning", message: `Statute of limitations expires in ${solDays} days (${c.statute_of_limitations})` });
  }
  if (daysSinceActivity !== null && daysSinceActivity > 60) {
    risks.push({ type: "stale", severity: daysSinceActivity > 120 ? "critical" : "warning", message: `No activity in ${daysSinceActivity} days — case may be stale` });
  }
  if (c.status === "Intake" && daysSinceActivity > 14) {
    risks.push({ type: "intake_delay", severity: "warning", message: "Case has been in Intake for over 2 weeks" });
  }

  const highestEstimate = (c.estimates || []).reduce((max, e) => Math.max(max, Number(e.amount) || 0), 0);
  const lastOffer = negs.filter(n => n.type === "defendant_offer").sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const lastDemand = negs.filter(n => n.type === "plaintiff_offer" || n.type === "presuit_demand").sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const nextSteps = [];
  if (c.status === "Intake") nextSteps.push("Complete intake documentation and initial case evaluation");
  if (c.status === "Investigation") nextSteps.push("Complete investigation and prepare demand package");
  if (c.status === "Presuit Demand") nextSteps.push("Follow up on demand — check for response deadline");
  if (c.status === "Presuit Negotiation" && !lastOffer) nextSteps.push("Await or follow up on insurer's response to demand");
  if (c.status === "Presuit Negotiation" && lastOffer) nextSteps.push("Evaluate latest offer and prepare counter or file suit");
  if (c.status?.startsWith("Litigation")) nextSteps.push("Review litigation deadlines and upcoming discovery due dates");
  if (solDays !== null && solDays < 90 && !c.status?.startsWith("Litigation")) nextSteps.push("URGENT: File suit before SOL expires");
  if (daysSinceActivity > 30) nextSteps.push("Update case file — no recent activity logged");

  const summary = {
    caseRef: c.ref,
    client: c.client_name,
    insurer: c.insurer,
    type: c.type,
    status: c.status,
    jurisdiction: c.jurisdiction,
    attorney: c.attorney?.name,
    support: c.support?.name,
    dateOfLoss: c.date_of_loss,
    dateOpened: c.date_opened,
    sol: c.statute_of_limitations,
    solDays,
    totalRecovery: Number(c.total_recovery) || 0,
    highestEstimate,
    lastDemand: lastDemand ? { amount: Number(lastDemand.amount), date: lastDemand.date } : null,
    lastOffer: lastOffer ? { amount: Number(lastOffer.amount), date: lastOffer.date } : null,
    negotiationCount: negs.length,
    activityCount: acts.length,
    lastActivityDate: lastActivity?.date,
    daysSinceActivity,
    risks,
    nextSteps,
  };

  return Response.json({ summary });
}

async function handleNaturalLanguageQuery(query) {
  if (!query) return Response.json({ error: "No query provided" }, { status: 400 });

  const q = query.toLowerCase();

  // Parse natural language into Supabase filters
  let supabaseQuery = supabase.from("cases").select(`
    *, attorney:team_members!cases_attorney_id_fkey(name, initials, color),
    support:team_members!cases_support_id_fkey(name, initials, color)
  `);

  // Insurer filter
  const insurers = ["State Farm", "Allstate", "USAA", "Liberty Mutual", "Nationwide", "Travelers", "Progressive", "Erie", "QBE", "Citizens", "Farmers", "American Family", "Auto-Owners", "Cincinnati Financial", "Westfield"];
  const matchedInsurer = insurers.find(ins => q.includes(ins.toLowerCase()));
  if (matchedInsurer) supabaseQuery = supabaseQuery.ilike("insurer", `%${matchedInsurer}%`);

  // Status filter
  const statuses = ["Intake", "Investigation", "Presuit Demand", "Presuit Negotiation", "Litigation - Filed", "Litigation - Discovery", "Litigation - Mediation", "Litigation - Trial Prep", "Appraisal", "Settled", "Closed"];
  if (q.includes("litigation") || q.includes("in lit")) {
    supabaseQuery = supabaseQuery.ilike("status", "Litigation%");
  } else if (q.includes("settled")) {
    supabaseQuery = supabaseQuery.eq("status", "Settled");
  } else if (q.includes("closed")) {
    supabaseQuery = supabaseQuery.eq("status", "Closed");
  } else if (q.includes("intake")) {
    supabaseQuery = supabaseQuery.eq("status", "Intake");
  } else if (q.includes("presuit")) {
    supabaseQuery = supabaseQuery.ilike("status", "Presuit%");
  } else if (q.includes("appraisal")) {
    supabaseQuery = supabaseQuery.eq("status", "Appraisal");
  } else if (q.includes("active") || q.includes("open")) {
    supabaseQuery = supabaseQuery.not("status", "in", '("Settled","Closed")');
  }

  // Jurisdiction filter
  const jurisMatch = q.match(/\b(kentucky|tennessee|montana|north carolina|texas|california|washington|colorado|new york|ky|tn|mt|nc|tx|ca|wa|co|ny)\b/i);
  if (jurisMatch) {
    const jurisMap = { kentucky: "KY", tennessee: "TN", montana: "MT", "north carolina": "NC", texas: "TX", california: "CA", washington: "WA", colorado: "CO", "new york": "NY" };
    const j = jurisMap[jurisMatch[1].toLowerCase()] || jurisMatch[1].toUpperCase();
    supabaseQuery = supabaseQuery.eq("jurisdiction", j);
  }

  // Case type filter
  if (q.includes("property")) supabaseQuery = supabaseQuery.ilike("type", "Property%");
  if (q.includes("personal injury") || q.includes("pi")) supabaseQuery = supabaseQuery.ilike("type", "Personal Injury%");
  if (q.includes("wind") || q.includes("hail")) supabaseQuery = supabaseQuery.ilike("type", "%Wind/Hail%");
  if (q.includes("fire")) supabaseQuery = supabaseQuery.ilike("type", "%Fire%");
  if (q.includes("water")) supabaseQuery = supabaseQuery.ilike("type", "%Water%");

  // SOL queries
  if (q.includes("sol") || q.includes("statute of limitation")) {
    const daysMatch = q.match(/(\d+)\s*days/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 90;
    const futureDate = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    supabaseQuery = supabaseQuery
      .gte("statute_of_limitations", today)
      .lte("statute_of_limitations", futureDate)
      .not("status", "in", '("Settled","Closed")');
  }

  // Client name search
  const clientMatch = q.match(/(?:case|client|for)\s+(\w+(?:\s+\w+)?)/i);
  if (clientMatch && !matchedInsurer && !q.includes("sol")) {
    supabaseQuery = supabaseQuery.ilike("client_name", `%${clientMatch[1]}%`);
  }

  supabaseQuery = supabaseQuery.order("date_opened", { ascending: false }).limit(50);

  const { data, error } = await supabaseQuery;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Generate a natural language description of results
  let description = "";
  if (data.length === 0) {
    description = "No cases found matching your query.";
  } else {
    description = `Found ${data.length} case${data.length === 1 ? "" : "s"}`;
    if (matchedInsurer) description += ` involving ${matchedInsurer}`;
    if (q.includes("litigation")) description += " in litigation";
    if (q.includes("sol")) description += " with approaching SOL deadlines";
    description += ".";
  }

  return Response.json({
    description,
    cases: data.map(c => ({
      id: c.id,
      ref: c.ref,
      client: c.client_name,
      type: c.type,
      status: c.status,
      jurisdiction: c.jurisdiction,
      insurer: c.insurer,
      dateOfLoss: c.date_of_loss,
      sol: c.statute_of_limitations,
      attorney: c.attorney?.name,
    })),
    count: data.length,
  });
}
