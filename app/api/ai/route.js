import { supabaseAdmin, supabase as supabaseAnon } from "../../../lib/supabase";

// Use admin client (bypasses RLS) if available, fall back to anon
const supabase = supabaseAdmin || supabaseAnon;

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

// ─── Date Parsing Helpers ─────────────────────────────────
const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseDateFromQuery(q) {
  // MM/DD/YY or MM/DD/YYYY
  let m = q.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const month = m[1].padStart(2, "0");
    const day = m[2].padStart(2, "0");
    return { type: "exact", date: `${year}-${month}-${day}` };
  }

  // "month day year" or "month day, year"
  m = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{2,4})\b/i);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const month = String(MONTH_MAP[m[1].toLowerCase()]).padStart(2, "0");
    const day = m[2].padStart(2, "0");
    return { type: "exact", date: `${year}-${month}-${day}` };
  }

  // "month year" (whole month)
  m = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/i);
  if (m) {
    const mon = MONTH_MAP[m[1].toLowerCase()];
    const year = parseInt(m[2]);
    const monthStr = String(mon).padStart(2, "0");
    const lastDay = new Date(year, mon, 0).getDate();
    return { type: "range", from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}` };
  }

  return null;
}

async function handleNaturalLanguageQuery(query) {
  if (!query) return Response.json({ error: "No query provided" }, { status: 400 });

  const q = query.toLowerCase();
  const descParts = [];

  // Parse natural language into Supabase filters
  let supabaseQuery = supabase.from("cases").select(`
    *, attorney:team_members!cases_attorney_id_fkey(name, initials, color),
    support:team_members!cases_support_id_fkey(name, initials, color)
  `);

  let hasFilter = false;

  // ─── Insurer filter ───────────────────────────────────
  const insurers = [
    "State Farm", "Allstate", "USAA", "Liberty Mutual", "Nationwide", "Travelers",
    "Progressive", "Erie", "QBE", "Citizens", "Farmers", "American Family", "Auto-Owners",
    "Cincinnati Financial", "Westfield", "Shelter", "KFB", "Kentucky Farm Bureau",
    "Farm Bureau", "Homesite", "Safeco", "Foremost", "Grange", "Encova",
    "Church Mutual", "Auto Owners", "Cincinnati", "Countryway", "Esurance",
    "American Bankers", "American Reliable", "Brotherhood Mutual", "Battle Creek",
    "BEVCO", "Everett Cash", "Flathead", "Sedgwick", "West Bend", "Stillwater",
    "Mercury", "Guide One", "Peninsula",
  ];
  const matchedInsurer = insurers.find(ins => q.includes(ins.toLowerCase()));
  if (matchedInsurer) {
    supabaseQuery = supabaseQuery.ilike("insurer", `%${matchedInsurer}%`);
    descParts.push(`involving ${matchedInsurer}`);
    hasFilter = true;
  }

  // ─── Loss type filter ─────────────────────────────────
  let matchedType = null;
  if (/\bhail\b/.test(q)) matchedType = "Hail";
  else if (/\bfire\b/.test(q)) matchedType = "Fire";
  else if (/\bwind\b/.test(q)) matchedType = "Wind";
  else if (/\bwater\b/.test(q) || /\bwater damage\b/.test(q)) matchedType = "Water";
  if (matchedType) {
    supabaseQuery = supabaseQuery.eq("type", matchedType);
    descParts.push(matchedType.toLowerCase());
    hasFilter = true;
  }

  // ─── Status filter ────────────────────────────────────
  let matchedStatus = null;
  if (/\bdemand(s)?\s*(sent|cases?)?\b/.test(q) || /\bpresuit demand\b/.test(q) || /\bcases? with demands?\b/.test(q)) {
    supabaseQuery = supabaseQuery.eq("status", "Presuit Demand");
    matchedStatus = "Presuit Demand";
  } else if (/\blitigation\b/.test(q) || /\bin lit\b/.test(q)) {
    supabaseQuery = supabaseQuery.ilike("status", "Litigation%");
    matchedStatus = "Litigation";
  } else if (/\bsettled\b/.test(q)) {
    supabaseQuery = supabaseQuery.eq("status", "Settled");
    matchedStatus = "Settled";
  } else if (/\bclosed\b/.test(q)) {
    supabaseQuery = supabaseQuery.eq("status", "Closed");
    matchedStatus = "Closed";
  } else if (/\bintake\b/.test(q)) {
    supabaseQuery = supabaseQuery.eq("status", "Intake");
    matchedStatus = "Intake";
  } else if (/\bnegotiat/.test(q)) {
    supabaseQuery = supabaseQuery.eq("status", "Presuit Negotiation");
    matchedStatus = "Presuit Negotiation";
  } else if (/\bpresuit\b/.test(q)) {
    supabaseQuery = supabaseQuery.ilike("status", "Presuit%");
    matchedStatus = "Presuit";
  } else if (/\bappraisal\b/.test(q)) {
    supabaseQuery = supabaseQuery.eq("status", "Appraisal");
    matchedStatus = "Appraisal";
  } else if (/\b(active|open)\b/.test(q)) {
    supabaseQuery = supabaseQuery.not("status", "in", '("Settled","Closed")');
    matchedStatus = "active";
  }
  if (matchedStatus) {
    descParts.push(`in ${matchedStatus} status`);
    hasFilter = true;
  }

  // ─── Date of Loss filter ──────────────────────────────
  const parsedDate = parseDateFromQuery(q);
  if (parsedDate) {
    if (parsedDate.type === "exact") {
      supabaseQuery = supabaseQuery.eq("date_of_loss", parsedDate.date);
      descParts.push(`from ${parsedDate.date}`);
    } else {
      supabaseQuery = supabaseQuery.gte("date_of_loss", parsedDate.from).lte("date_of_loss", parsedDate.to);
      descParts.push(`from ${parsedDate.from} to ${parsedDate.to}`);
    }
    hasFilter = true;
  }

  // ─── Jurisdiction filter ──────────────────────────────
  const jurisMatch = q.match(/\b(kentucky|tennessee|montana|north carolina|texas|california|washington|colorado|new york|ohio|indiana|nebraska|south carolina|michigan|wyoming|missouri|arizona|ky|tn|mt|nc|tx|ca|wa|co|ny|oh|in|ne|sc|mi|wy|mo|az)\b/i);
  if (jurisMatch) {
    const jurisMap = { kentucky: "KY", tennessee: "TN", montana: "MT", "north carolina": "NC", texas: "TX", california: "CA", washington: "WA", colorado: "CO", "new york": "NY", ohio: "OH", indiana: "IN", nebraska: "NE", "south carolina": "SC", michigan: "MI", wyoming: "WY", missouri: "MO", arizona: "AZ" };
    const j = jurisMap[jurisMatch[1].toLowerCase()] || jurisMatch[1].toUpperCase();
    supabaseQuery = supabaseQuery.eq("jurisdiction", j);
    descParts.push(`in ${j}`);
    hasFilter = true;
  }

  // ─── SOL queries ──────────────────────────────────────
  if (/\bsol\b/.test(q) || /\bstatute of limitation/.test(q)) {
    const daysMatch = q.match(/(\d+)\s*days/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 90;
    const futureDate = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    supabaseQuery = supabaseQuery
      .gte("statute_of_limitations", today)
      .lte("statute_of_limitations", futureDate)
      .not("status", "in", '("Settled","Closed")');
    descParts.push(`with SOL within ${days} days`);
    hasFilter = true;
  }

  // ─── Client name search ───────────────────────────────
  const clientMatch = q.match(/(?:case|client|for)\s+(\w+(?:\s+\w+)?)/i);
  if (clientMatch && !matchedInsurer && !matchedType && !matchedStatus) {
    supabaseQuery = supabaseQuery.ilike("client_name", `%${clientMatch[1]}%`);
    descParts.push(`for client "${clientMatch[1]}"`);
    hasFilter = true;
  }

  // If no structured filters matched, try the raw query as a name search
  if (!hasFilter) {
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      supabaseQuery = supabaseQuery.ilike("client_name", `%${trimmed}%`);
      descParts.push(`matching "${trimmed}"`);
    }
  }

  supabaseQuery = supabaseQuery.order("date_opened", { ascending: false }).limit(50);

  const { data, error } = await supabaseQuery;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Generate descriptive result text
  let description = "";
  if (data.length === 0) {
    description = "No cases found matching your query.";
  } else {
    const typePart = descParts.length > 0 ? ` ${descParts.join(" ")}` : "";
    description = `Found ${data.length} case${data.length === 1 ? "" : "s"}${typePart}.`;
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
