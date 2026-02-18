import { supabaseAdmin, supabase } from "../../../lib/supabase";

/**
 * GET /api/reports?type=summary|pipeline|attorneys|insurers|aging|financial|sol
 *
 * Server-side report aggregations. Faster and more accurate than client-side computation.
 */
export async function GET(request) {
  const client = supabaseAdmin || supabase;
  if (!client) return Response.json({ error: "No Supabase client" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "summary";

  try {
    switch (type) {
      case "summary": return Response.json(await getSummary(client));
      case "pipeline": return Response.json(await getPipeline(client));
      case "attorneys": return Response.json(await getAttorneys(client));
      case "insurers": return Response.json(await getInsurers(client));
      case "aging": return Response.json(await getAging(client));
      case "financial": return Response.json(await getFinancial(client));
      case "sol": return Response.json(await getSOL(client));
      case "volume": return Response.json(await getVolume(client));
      default: return Response.json({ error: `Unknown report type: ${type}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[reports] error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function getSummary(client) {
  const { data: cases } = await client
    .from("cases")
    .select("id, status, type, total_recovery, attorney_fees, date_opened, statute_of_limitations");

  const now = new Date();
  const total = cases.length;
  const active = cases.filter(c => !["Closed", "Settled", "Settlement"].includes(c.status)).length;
  const settled = cases.filter(c => ["Settled", "Settlement"].includes(c.status)).length;
  const inLitigation = cases.filter(c => (c.status || "").startsWith("Litigation")).length;
  const totalRecovery = cases.reduce((s, c) => s + (Number(c.total_recovery) || 0), 0);
  const totalFees = cases.reduce((s, c) => s + (Number(c.attorney_fees) || 0), 0);

  const sol30 = cases.filter(c => {
    if (!c.statute_of_limitations) return false;
    const d = new Date(c.statute_of_limitations);
    return d >= now && d <= new Date(now.getTime() + 30 * 86400000);
  }).length;

  const thisMonth = now.toISOString().slice(0, 7);
  const openedThisMonth = cases.filter(c => (c.date_opened || "").startsWith(thisMonth)).length;

  const byType = {};
  cases.forEach(c => { byType[c.type || "Unknown"] = (byType[c.type || "Unknown"] || 0) + 1; });

  return {
    total, active, settled, inLitigation, totalRecovery, totalFees,
    solUrgent30: sol30, openedThisMonth, byType,
  };
}

async function getPipeline(client) {
  const { data: cases } = await client.from("cases").select("status");
  const counts = {};
  cases.forEach(c => { counts[c.status || "Unknown"] = (counts[c.status || "Unknown"] || 0) + 1; });
  const pipeline = Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  return { pipeline, total: cases.length };
}

async function getAttorneys(client) {
  const { data: cases } = await client
    .from("cases")
    .select("status, total_recovery, attorney_fees, date_opened, attorney:team_members!cases_attorney_id_fkey(id, name)");

  const map = {};
  cases.forEach(c => {
    const name = c.attorney?.name || "Unassigned";
    const id = c.attorney?.id || "unassigned";
    if (!map[id]) map[id] = { name, active: 0, settled: 0, totalRecovery: 0, totalFees: 0, totalCases: 0 };
    const m = map[id];
    m.totalCases++;
    const isSettled = ["Settled", "Settlement", "Closed"].includes(c.status);
    if (isSettled) {
      m.settled++;
      m.totalRecovery += Number(c.total_recovery) || 0;
      m.totalFees += Number(c.attorney_fees) || 0;
    } else {
      m.active++;
    }
  });

  const attorneys = Object.values(map).map(a => ({
    ...a,
    avgRecovery: a.settled > 0 ? a.totalRecovery / a.settled : 0,
    settleRate: a.totalCases > 0 ? a.settled / a.totalCases : 0,
  })).sort((a, b) => b.totalRecovery - a.totalRecovery);

  return { attorneys };
}

async function getInsurers(client) {
  const { data: cases } = await client
    .from("cases")
    .select("insurer, status, type, total_recovery, date_opened, date_of_loss");

  const map = {};
  cases.forEach(c => {
    const ins = c.insurer || "Unknown";
    if (!map[ins]) map[ins] = { name: ins, total: 0, settled: 0, totalRecovery: 0, litigation: 0, byType: {} };
    const m = map[ins];
    m.total++;
    m.byType[c.type || "Unknown"] = (m.byType[c.type || "Unknown"] || 0) + 1;

    const status = (c.status || "").toLowerCase();
    if (status.includes("settled") || status.includes("settlement") || status === "closed") {
      m.settled++;
      m.totalRecovery += Number(c.total_recovery) || 0;
    }
    if (status.includes("litigat")) m.litigation++;
  });

  const insurers = Object.values(map).map(i => ({
    ...i,
    avgRecovery: i.settled > 0 ? i.totalRecovery / i.settled : 0,
    litigationRate: i.total > 0 ? i.litigation / i.total : 0,
  })).sort((a, b) => b.total - a.total);

  return { insurers };
}

async function getAging(client) {
  const { data: cases } = await client
    .from("cases")
    .select("id, ref, client_name, status, type, insurer, date_opened, date_of_loss, attorney:team_members!cases_attorney_id_fkey(name)");

  const now = new Date();
  const activeCases = cases.filter(c => !["Closed", "Settled", "Settlement"].includes(c.status));

  const aged = activeCases.map(c => {
    const opened = c.date_opened ? new Date(c.date_opened) : null;
    const daysOpen = opened ? Math.floor((now - opened) / 86400000) : null;
    return { ...c, daysOpen };
  }).filter(c => c.daysOpen !== null).sort((a, b) => b.daysOpen - a.daysOpen);

  const buckets = { "0-30": 0, "31-90": 0, "91-180": 0, "181-365": 0, "365+": 0 };
  aged.forEach(c => {
    if (c.daysOpen <= 30) buckets["0-30"]++;
    else if (c.daysOpen <= 90) buckets["31-90"]++;
    else if (c.daysOpen <= 180) buckets["91-180"]++;
    else if (c.daysOpen <= 365) buckets["181-365"]++;
    else buckets["365+"]++;
  });

  const byStatus = {};
  aged.forEach(c => {
    if (!byStatus[c.status]) byStatus[c.status] = { total: 0, count: 0 };
    byStatus[c.status].total += c.daysOpen;
    byStatus[c.status].count++;
  });
  const avgByStatus = Object.entries(byStatus).map(([status, d]) => ({
    status, avgDays: Math.round(d.total / d.count), count: d.count,
  })).sort((a, b) => b.avgDays - a.avgDays);

  const avgDaysOpen = aged.length > 0 ? Math.round(aged.reduce((s, c) => s + c.daysOpen, 0) / aged.length) : 0;

  const oldest = aged.slice(0, 20).map(c => ({
    ref: c.ref, client_name: c.client_name, status: c.status, type: c.type,
    insurer: c.insurer, attorney: c.attorney?.name, daysOpen: c.daysOpen,
  }));

  return { buckets, avgByStatus, avgDaysOpen, oldest, totalActive: activeCases.length };
}

async function getFinancial(client) {
  const { data: cases } = await client
    .from("cases")
    .select("id, ref, client_name, status, type, insurer, total_recovery, attorney_fees, date_opened");

  const settled = cases.filter(c => (Number(c.total_recovery) || 0) > 0);
  const totalRecovery = settled.reduce((s, c) => s + (Number(c.total_recovery) || 0), 0);
  const totalFees = settled.reduce((s, c) => s + (Number(c.attorney_fees) || 0), 0);
  const avgRecovery = settled.length > 0 ? totalRecovery / settled.length : 0;

  const byMonth = {};
  settled.forEach(c => {
    const month = (c.date_opened || "").slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = { recovery: 0, fees: 0, count: 0 };
    byMonth[month].recovery += Number(c.total_recovery) || 0;
    byMonth[month].fees += Number(c.attorney_fees) || 0;
    byMonth[month].count++;
  });

  const topSettlements = settled
    .sort((a, b) => (Number(b.total_recovery) || 0) - (Number(a.total_recovery) || 0))
    .slice(0, 20)
    .map(c => ({
      ref: c.ref, client_name: c.client_name, insurer: c.insurer, type: c.type,
      total_recovery: Number(c.total_recovery), attorney_fees: Number(c.attorney_fees),
    }));

  return { totalRecovery, totalFees, avgRecovery, settledCount: settled.length, byMonth, topSettlements };
}

async function getSOL(client) {
  const now = new Date();
  const { data: cases } = await client
    .from("cases")
    .select("id, ref, client_name, status, type, insurer, jurisdiction, statute_of_limitations, attorney:team_members!cases_attorney_id_fkey(name)")
    .not("statute_of_limitations", "is", null)
    .gte("statute_of_limitations", now.toISOString().split("T")[0])
    .order("statute_of_limitations", { ascending: true });

  const deadlines = (cases || []).map(c => {
    const solDate = new Date(c.statute_of_limitations);
    const daysLeft = Math.ceil((solDate - now) / 86400000);
    return {
      ref: c.ref, client_name: c.client_name, status: c.status, type: c.type,
      insurer: c.insurer, jurisdiction: c.jurisdiction, attorney: c.attorney?.name,
      sol_date: c.statute_of_limitations, daysLeft,
      urgency: daysLeft <= 14 ? "critical" : daysLeft <= 30 ? "high" : daysLeft <= 90 ? "medium" : "low",
    };
  });

  return {
    deadlines,
    critical: deadlines.filter(d => d.urgency === "critical").length,
    high: deadlines.filter(d => d.urgency === "high").length,
    total: deadlines.length,
  };
}

async function getVolume(client) {
  const { data: cases } = await client.from("cases").select("date_opened, type, status");

  const now = new Date();
  const months = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[d.toISOString().slice(0, 7)] = { opened: 0, byType: {} };
  }

  cases.forEach(c => {
    const key = (c.date_opened || "").slice(0, 7);
    if (key in months) {
      months[key].opened++;
      months[key].byType[c.type || "Unknown"] = (months[key].byType[c.type || "Unknown"] || 0) + 1;
    }
  });

  return {
    months: Object.entries(months).map(([month, data]) => ({ month, ...data })),
  };
}
