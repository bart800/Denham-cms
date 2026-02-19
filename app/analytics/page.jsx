"use client";
import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a", bg: "#08080f",
  card: "#111119", bdr: "#1e1e2e", txt: "#e8e8f0", txtM: "#8888a0",
  txtD: "#55556a", danger: "#e04050",
};

const cardStyle = {
  background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20,
};

const fmt$ = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

const COLORS = ["#ebb003", "#5b8def", "#386f4a", "#c77dba", "#e04050", "#4ecdc4", "#ff6b6b", "#a8e6cf", "#ffd93d", "#6c5ce7", "#fd79a8", "#00b894", "#e17055", "#0984e3", "#fdcb6e"];

function SummaryCard({ label, value, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, color: B.txtM, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || B.gold, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a2e", border: `1px solid ${B.bdr}`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: B.txt, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || B.gold }}>{p.name}: {p.value}{p.name === "Denial Rate" ? "%" : ""}</div>
      ))}
    </div>
  );
}

export default function InsurerAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("total_cases");
  const [sortDir, setSortDir] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [causeFilter, setCauseFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (causeFilter) params.set("cause_of_loss", causeFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    fetch(`/api/analytics/insurers${qs ? "?" + qs : ""}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, [statusFilter, causeFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    if (!data?.insurers) return [];
    return [...data.insurers].sort((a, b) => {
      const av = a[sortField] ?? 0, bv = b[sortField] ?? 0;
      return sortDir === "desc" ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }, [data, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortIcon = (field) => sortField === field ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  if (loading && !data) {
    return (
      <div style={{ minHeight: "100vh", background: B.bg, padding: "32px 40px", color: B.txt }}>
        <div style={{ fontSize: 18, color: B.txtM }}>Loading insurer analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: B.bg, padding: "32px 40px", color: B.danger }}>
        Error: {error}
      </div>
    );
  }

  const { summary, filter_options } = data;
  const top15 = sorted.slice(0, 15);

  const casesChartData = top15.map((d) => ({ name: d.insurer.length > 20 ? d.insurer.slice(0, 18) + "…" : d.insurer, cases: d.total_cases }));
  const denialChartData = sorted.filter(d => d.total_cases >= 2).slice(0, 15).map((d) => ({
    name: d.insurer.length > 20 ? d.insurer.slice(0, 18) + "…" : d.insurer,
    rate: d.denial_rate,
  }));

  const inputStyle = {
    background: "#0a0a1e", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 12px",
    color: B.txt, fontSize: 13, outline: "none", minWidth: 140,
  };

  const thStyle = {
    padding: "10px 14px", textAlign: "left", fontSize: 12, textTransform: "uppercase",
    letterSpacing: 0.5, color: B.txtM, cursor: "pointer", userSelect: "none",
    borderBottom: `1px solid ${B.bdr}`, fontWeight: 600, whiteSpace: "nowrap",
  };

  const tdStyle = { padding: "10px 14px", fontSize: 13, color: B.txt, borderBottom: `1px solid rgba(30,30,46,0.5)` };

  return (
    <div style={{ minHeight: "100vh", background: B.bg, padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <a href="/admin" style={{ color: B.txtM, textDecoration: "none", fontSize: 14 }}>← Back</a>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${B.navy}, ${B.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>D</div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: B.txt }}>Insurance Company Analytics</h1>
          <p style={{ fontSize: 12, color: B.txtD }}>Performance metrics by insurer</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        <SummaryCard label="Total Cases" value={summary.total_cases} color={B.gold} />
        <SummaryCard label="Insurers" value={summary.total_insurers} color="#5b8def" />
        <SummaryCard label="Avg Denial Rate" value={summary.avg_denial_rate + "%"} color={B.danger} />
        <SummaryCard label="Total Denied" value={summary.total_denied} color="#c77dba" />
        <SummaryCard label="Top Insurer" value={summary.top_insurer?.length > 15 ? summary.top_insurer.slice(0, 13) + "…" : summary.top_insurer} color={B.green} />
        <SummaryCard label="Total Estimates" value={fmt$(summary.total_estimates)} color="#4ecdc4" />
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: B.txtM, fontSize: 13, fontWeight: 600 }}>FILTERS:</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="">All Statuses</option>
          {(filter_options?.statuses || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={causeFilter} onChange={(e) => setCauseFilter(e.target.value)} style={inputStyle}>
          <option value="">All Causes</option>
          {(filter_options?.causes || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: B.txtD, fontSize: 12 }}>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
          <span style={{ color: B.txtD, fontSize: 12 }}>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </div>
        {(statusFilter || causeFilter || dateFrom || dateTo) && (
          <button onClick={() => { setStatusFilter(""); setCauseFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{ background: "none", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 14px", color: B.danger, cursor: "pointer", fontSize: 12 }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: B.gold, marginBottom: 16 }}>Cases by Insurer (Top 15)</h3>
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={casesChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: B.txtM, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: B.txtM, fontSize: 11 }} width={150} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="cases" name="Cases" radius={[0, 4, 4, 0]}>
                  {casesChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: B.gold, marginBottom: 16 }}>Denial Rate Comparison (≥2 cases)</h3>
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={denialChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: B.txtM, fontSize: 11 }} tickFormatter={(v) => v + "%"} />
                <YAxis type="category" dataKey="name" tick={{ fill: B.txtM, fontSize: 11 }} width={150} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="rate" name="Denial Rate" radius={[0, 4, 4, 0]}>
                  {denialChartData.map((d, i) => (
                    <Cell key={i} fill={d.rate > 70 ? B.danger : d.rate > 40 ? B.gold : B.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: B.gold, marginBottom: 16 }}>All Insurers</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort("insurer")}>Insurer{sortIcon("insurer")}</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("total_cases")}>Cases{sortIcon("total_cases")}</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("denial_rate")}>Denial Rate{sortIcon("denial_rate")}</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("denied_count")}>Denied{sortIcon("denied_count")}</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("avg_days_to_denial")}>Avg Days to Denial{sortIcon("avg_days_to_denial")}</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("estimate_total")}>Estimates{sortIcon("estimate_total")}</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("avg_case_duration_days")}>Avg Duration (days){sortIcon("avg_case_duration_days")}</th>
              <th style={thStyle}>Top Causes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const topCauses = Object.entries(row.causes || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} (${v})`).join(", ");
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.insurer}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{row.total_cases}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: row.denial_rate > 70 ? B.danger : row.denial_rate > 40 ? B.gold : B.green }}>
                    {row.denial_rate}%
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{row.denied_count}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: B.txtM }}>{row.avg_days_to_denial ?? "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{row.estimate_total ? fmt$(row.estimate_total) : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: B.txtM }}>{row.avg_case_duration_days ?? "—"}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: B.txtM, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topCauses || "—"}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: B.txtM, padding: 40 }}>No data found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
