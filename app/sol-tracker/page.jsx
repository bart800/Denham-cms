"use client";
import { useState, useEffect, useMemo } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const CARD_BG = "#0a0a2e";
const CARD_BORDER = "1px solid rgba(235,176,3,0.15)";
const TEXT = "#e0e0e0";
const TEXT_DIM = "#888";

const STATUS_COLORS = {
  expired: { bg: "#3a0a0a", border: "#e53935", text: "#ff6b6b", label: "EXPIRED" },
  critical: { bg: "#3a1a00", border: "#ff9800", text: "#ffb74d", label: "CRITICAL" },
  warning: { bg: "#3a3000", border: "#fdd835", text: "#fff176", label: "WARNING" },
  ok: { bg: "#0a2a1a", border: "#4caf50", text: "#81c784", label: "OK" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CountCard({ label, count, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: CARD_BG, border: `2px solid ${color}`, borderRadius: 12, padding: "20px 24px",
        textAlign: "center", cursor: "pointer", transition: "transform 0.15s",
        minWidth: 140, flex: 1,
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{ fontSize: 36, fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: TEXT_DIM, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.ok;
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>
      {s.label}
    </span>
  );
}

export default function SOLTrackerPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("days_remaining");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetch("/api/sol-tracker")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.items;
    if (filter !== "all") items = items.filter(i => i.sol_status === filter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        (i.client_name || "").toLowerCase().includes(q) ||
        (i.case_number || "").toLowerCase().includes(q) ||
        (i.attorney || "").toLowerCase().includes(q) ||
        (i.insurer || "").toLowerCase().includes(q)
      );
    }
    const sorted = [...items].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") av = av?.toLowerCase() || "";
      if (typeof bv === "string") bv = bv?.toLowerCase() || "";
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, filter, search, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ k, children, width }) => (
    <th
      onClick={() => handleSort(k)}
      style={{
        padding: "12px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase",
        letterSpacing: 1, color: GOLD, cursor: "pointer", userSelect: "none",
        borderBottom: "1px solid rgba(235,176,3,0.2)", width, whiteSpace: "nowrap",
      }}
    >
      {children} {sortKey === k ? (sortAsc ? "▲" : "▼") : ""}
    </th>
  );

  if (loading) {
    return (
      <div style={{ background: "#08080f", minHeight: "100vh", color: TEXT, padding: 40, fontFamily: "system-ui" }}>
        <h1 style={{ color: GOLD, fontSize: 24, margin: "0 0 24px" }}>⏱️ SOL Countdown Tracker</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: CARD_BG, borderRadius: 12, height: 90, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#08080f", minHeight: "100vh", color: TEXT, padding: 40, fontFamily: "system-ui" }}>
        <h1 style={{ color: "#e53935" }}>⚠️ Error loading SOL data</h1>
        <p style={{ color: TEXT_DIM }}>{error}</p>
      </div>
    );
  }

  const { counts } = data;

  return (
    <div style={{ background: "#08080f", minHeight: "100vh", color: TEXT, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ color: GOLD, fontSize: 26, margin: 0, fontWeight: 700 }}>⏱️ Statute of Limitations Tracker</h1>
            <p style={{ color: TEXT_DIM, fontSize: 13, margin: "6px 0 0" }}>
              {data.total} cases tracked • Updated {new Date(data.generated).toLocaleTimeString()}
            </p>
          </div>
          <a href="/" style={{ color: GOLD, textDecoration: "none", fontSize: 14, padding: "8px 16px", border: `1px solid ${GOLD}`, borderRadius: 8 }}>
            ← Back to CMS
          </a>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <CountCard label="Expired" count={counts.expired} color="#e53935" onClick={() => setFilter(f => f === "expired" ? "all" : "expired")} />
          <CountCard label="Critical (<30d)" count={counts.critical} color="#ff9800" onClick={() => setFilter(f => f === "critical" ? "all" : "critical")} />
          <CountCard label="Warning (<90d)" count={counts.warning} color="#fdd835" onClick={() => setFilter(f => f === "warning" ? "all" : "warning")} />
          <CountCard label="OK" count={counts.ok} color="#4caf50" onClick={() => setFilter(f => f === "ok" ? "all" : "ok")} />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text" placeholder="Search cases, attorneys, insurers..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.06)", border: CARD_BORDER, borderRadius: 8,
              padding: "10px 16px", color: TEXT, fontSize: 14, flex: 1, minWidth: 250, outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "expired", "critical", "warning", "ok"].map(f => (
              <button
                key={f} onClick={() => setFilter(f)}
                style={{
                  padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  textTransform: "uppercase", cursor: "pointer", border: "none",
                  background: filter === f ? GOLD : "rgba(255,255,255,0.08)",
                  color: filter === f ? "#000" : TEXT_DIM,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader k="sol_status" width={90}>Status</SortHeader>
                  <SortHeader k="days_remaining" width={80}>Days</SortHeader>
                  <SortHeader k="client_name">Client</SortHeader>
                  <SortHeader k="case_number">Case #</SortHeader>
                  <SortHeader k="sol_deadline">SOL Date</SortHeader>
                  <SortHeader k="attorney">Attorney</SortHeader>
                  <SortHeader k="insurer">Insurer</SortHeader>
                  <SortHeader k="case_status">Case Status</SortHeader>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: TEXT_DIM }}>No cases found</td></tr>
                ) : filtered.map(item => {
                  const sc = STATUS_COLORS[item.sol_status];
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(235,176,3,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 14px" }}><Badge status={item.sol_status} /></td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 16, color: sc.text, fontVariantNumeric: "tabular-nums" }}>
                        {item.days_remaining < 0 ? `${Math.abs(item.days_remaining)}d overdue` : `${item.days_remaining}d`}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: TEXT }}>{item.client_name || "—"}</td>
                      <td style={{ padding: "12px 14px", color: TEXT_DIM, fontFamily: "monospace", fontSize: 13 }}>{item.case_number || "—"}</td>
                      <td style={{ padding: "12px 14px", color: TEXT }}>{fmtDate(item.sol_deadline)}</td>
                      <td style={{ padding: "12px 14px", color: TEXT }}>{item.attorney || "—"}</td>
                      <td style={{ padding: "12px 14px", color: TEXT }}>{item.insurer || "—"}</td>
                      <td style={{ padding: "12px 14px", color: TEXT_DIM }}>{item.case_status || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ color: TEXT_DIM, fontSize: 11, marginTop: 16, textAlign: "center" }}>
          Showing {filtered.length} of {data.total} cases
        </p>
      </div>
    </div>
  );
}
