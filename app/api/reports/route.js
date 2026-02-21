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
      case "monthly_performance": return Response.json(await getMonthlyPerformance(client, searchParams));
      case "insurer_response": return Response.json(await getInsurerResponse(client, searchParams));
      case "attorney_productivity": return Response.json(await getAttorneyProductivity(client, searchParams));
      case "case_aging_detail": return Response.json(await getCaseAgingDetail(client, searchParams));
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

// ═══════ NEW REPORT TYPES ═══════

function parseDateRange(searchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  return { from: from || null, to: to || null };
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

async function getMonthlyPerformance(client, searchParams) {
  const { from, to } = parseDateRange(searchParams);
  const { data: cases } = await client
    .from("cases")
    .select("id, status, total_recovery, date_opened, date_settled, date_of_loss");

  const months = {};
  const isSettled = s => ["Settled", "Settlement"].includes(s);

  cases.forEach(c => {
    const openMonth = (c.date_opened || "").slice(0, 7);
    if (openMonth && inRange(c.date_opened, from, to)) {
      if (!months[openMonth]) months[openMonth] = { opened: 0, settled: 0, totalRecovery: 0, totalDaysToSettle: 0, settledCount: 0 };
      months[openMonth].opened++;
    }
    if (isSettled(c.status)) {
      const settleMonth = (c.date_settled || c.date_opened || "").slice(0, 7);
      if (settleMonth && inRange(c.date_settled || c.date_opened, from, to)) {
        if (!months[settleMonth]) months[settleMonth] = { opened: 0, settled: 0, totalRecovery: 0, totalDaysToSettle: 0, settledCount: 0 };
        months[settleMonth].settled++;
        months[settleMonth].totalRecovery += Number(c.total_recovery) || 0;
        if (c.date_opened && (c.date_settled || c.date_opened)) {
          const days = Math.floor((new Date(c.date_settled || c.date_opened) - new Date(c.date_opened)) / 86400000);
          if (days >= 0) { months[settleMonth].totalDaysToSettle += days; months[settleMonth].settledCount++; }
        }
      }
    }
  });

  const rows = Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, d]) => ({
      month,
      opened: d.opened,
      settled: d.settled,
      totalRecovery: d.totalRecovery,
      avgDaysToSettle: d.settledCount > 0 ? Math.round(d.totalDaysToSettle / d.settledCount) : null,
    }));

  const totals = rows.reduce((acc, r) => ({
    opened: acc.opened + r.opened,
    settled: acc.settled + r.settled,
    totalRecovery: acc.totalRecovery + r.totalRecovery,
  }), { opened: 0, settled: 0, totalRecovery: 0 });

  return { rows, totals };
}

async function getInsurerResponse(client, searchParams) {
  const { from, to } = parseDateRange(searchParams);
  // Use case_activities or negotiations for demand/response tracking
  const { data: cases } = await client
    .from("cases")
    .select("id, insurer, status, date_opened, demand_date, demand_response_date, total_recovery");

  const insurerMap = {};
  cases.forEach(c => {
    if (from && c.date_opened && c.date_opened < from) return;
    if (to && c.date_opened && c.date_opened > to) return;
    const ins = c.insurer || "Unknown";
    if (!insurerMap[ins]) insurerMap[ins] = { name: ins, totalDays: 0, count: 0, cases: 0, totalRecovery: 0, settled: 0 };
    const m = insurerMap[ins];
    m.cases++;
    if (["Settled", "Settlement"].includes(c.status)) {
      m.settled++;
      m.totalRecovery += Number(c.total_recovery) || 0;
    }
    if (c.demand_date && c.demand_response_date) {
      const days = Math.floor((new Date(c.demand_response_date) - new Date(c.demand_date)) / 86400000);
      if (days >= 0) { m.totalDays += days; m.count++; }
    }
  });

  const rows = Object.values(insurerMap)
    .map(m => ({
      ...m,
      avgResponseDays: m.count > 0 ? Math.round(m.totalDays / m.count) : null,
      avgRecovery: m.settled > 0 ? Math.round(m.totalRecovery / m.settled) : 0,
    }))
    .sort((a, b) => b.cases - a.cases);

  return { rows };
}

async function getAttorneyProductivity(client, searchParams) {
  const { from, to } = parseDateRange(searchParams);

  const { data: cases } = await client
    .from("cases")
    .select("id, status, total_recovery, attorney_fees, date_opened, date_settled, attorney:team_members!cases_attorney_id_fkey(id, name)");

  // Fetch tasks
  const { data: tasks } = await client.from("case_tasks").select("id, status, assigned_to, completed_at");

  const map = {};
  cases.forEach(c => {
    if (from && c.date_opened && c.date_opened < from) return;
    if (to && c.date_opened && c.date_opened > to) return;
    const name = c.attorney?.name || "Unassigned";
    const id = c.attorney?.id || "unassigned";
    if (!map[id]) map[id] = { name, cases: 0, active: 0, settled: 0, totalRecovery: 0, totalFees: 0, tasksCompleted: 0, tasksTotal: 0, avgDaysToSettle: 0, settledCount: 0 };
    const m = map[id];
    m.cases++;
    if (["Settled", "Settlement"].includes(c.status)) {
      m.settled++;
      m.totalRecovery += Number(c.total_recovery) || 0;
      m.totalFees += Number(c.attorney_fees) || 0;
      if (c.date_opened && c.date_settled) {
        const days = Math.floor((new Date(c.date_settled) - new Date(c.date_opened)) / 86400000);
        if (days >= 0) { m.avgDaysToSettle += days; m.settledCount++; }
      }
    } else {
      m.active++;
    }
  });

  // Count tasks per attorney
  if (tasks) {
    tasks.forEach(t => {
      const id = t.assigned_to || "unassigned";
      if (map[id]) {
        map[id].tasksTotal++;
        if (t.status === "completed" || t.completed_at) map[id].tasksCompleted++;
      }
    });
  }

  const rows = Object.values(map).map(m => ({
    ...m,
    avgDaysToSettle: m.settledCount > 0 ? Math.round(m.avgDaysToSettle / m.settledCount) : null,
    settleRate: m.cases > 0 ? m.settled / m.cases : 0,
    avgRecovery: m.settled > 0 ? Math.round(m.totalRecovery / m.settled) : 0,
  })).sort((a, b) => b.totalRecovery - a.totalRecovery);

  return { rows };
}

async function getCaseAgingDetail(client, searchParams) {
  const { from, to } = parseDateRange(searchParams);
  const { data: cases } = await client
    .from("cases")
    .select("id, ref, client_name, status, type, insurer, date_opened, attorney:team_members!cases_attorney_id_fkey(name)");

  const now = new Date();
  const active = cases.filter(c => {
    if (["Closed", "Settled", "Settlement"].includes(c.status)) return false;
    if (from && c.date_opened && c.date_opened < from) return false;
    if (to && c.date_opened && c.date_opened > to) return false;
    return true;
  });

  const bucketDefs = [
    { label: "0-30", min: 0, max: 30 },
    { label: "31-90", min: 31, max: 90 },
    { label: "91-180", min: 91, max: 180 },
    { label: "181-365", min: 181, max: 365 },
    { label: "365+", min: 366, max: Infinity },
  ];

  // Cross-tab: bucket × phase(status)
  const phases = {};
  const bucketCounts = {};
  bucketDefs.forEach(b => { bucketCounts[b.label] = 0; });

  const caseDetails = active.map(c => {
    const opened = c.date_opened ? new Date(c.date_opened) : null;
    const days = opened ? Math.floor((now - opened) / 86400000) : null;
    const bucket = bucketDefs.find(b => days >= b.min && days <= b.max)?.label || "Unknown";
    const phase = c.status || "Unknown";
    if (!phases[phase]) phases[phase] = {};
    if (!phases[phase][bucket]) phases[phase][bucket] = 0;
    phases[phase][bucket]++;
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
    return { ref: c.ref, client_name: c.client_name, status: phase, type: c.type, insurer: c.insurer, attorney: c.attorney?.name, daysOpen: days, bucket };
  }).filter(c => c.daysOpen !== null).sort((a, b) => b.daysOpen - a.daysOpen);

  // Build cross-tab rows
  const crossTab = Object.entries(phases).map(([phase, buckets]) => ({
    phase,
    ...Object.fromEntries(bucketDefs.map(b => [b.label, buckets[b.label] || 0])),
    total: Object.values(buckets).reduce((s, v) => s + v, 0),
  })).sort((a, b) => b.total - a.total);

  return { bucketCounts, crossTab, cases: caseDetails.slice(0, 50), totalActive: active.length };
}
