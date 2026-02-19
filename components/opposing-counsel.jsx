"use client";
import React, { useState, useEffect, useMemo } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e", bdrL: "#2a2a3a",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050", purple: "#7c5cbf",
};
const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
  th: { textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" },
  td: { padding: "10px 14px", borderBottom: `1px solid ${B.bdr}06`, fontSize: 13 },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 },
};

const fmt = (n) => "$" + Number(n).toLocaleString("en-US");

export default function OpposingCounsel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("totalCases");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab] = useState("counsel"); // counsel | judges

  useEffect(() => {
    fetch("/api/analytics/counsel")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = tab === "counsel" ? data.counsel : data.judges;
    const q = search.toLowerCase();
    const f = q ? list.filter((r) => r.name.toLowerCase().includes(q) || (r.firm || "").toLowerCase().includes(q)) : list;
    return [...f].sort((a, b) => {
      const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [data, search, sortKey, sortAsc, tab]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading counsel intelligence...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: B.danger }}>Failed to load data</div>;

  const s = data.summary;

  return (
    <div style={{ padding: "24px 0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: B.txt, marginBottom: 20 }}>⚖️ Opposing Counsel Intelligence</h2>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Attorneys", value: s.totalAttorneys, color: B.purple },
          { label: "Firms", value: s.totalFirms, color: B.gold },
          { label: "Litigation Cases", value: s.totalLitigationCases, color: B.green },
          { label: "Judges", value: s.totalJudges, color: B.navy === "#000066" ? "#5b8def" : B.navy },
        ].map((c, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 11, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color, ...S.mono }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "counsel", label: "👤 Attorneys" }, { id: "judges", label: "🏛️ Judges" }].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setExpanded(null); setSortKey("totalCases"); }}
            style={{ padding: "8px 20px", borderRadius: 6, border: `1px solid ${tab === t.id ? B.gold : B.bdr}`, background: tab === t.id ? `${B.gold}18` : "transparent", color: tab === t.id ? B.gold : B.txtM, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        placeholder={`Search ${tab === "counsel" ? "attorneys or firms" : "judges"}...`}
        value={search} onChange={(e) => setSearch(e.target.value)}
        style={{ width: 300, padding: "8px 12px", background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6, color: B.txt, fontSize: 13, outline: "none", marginBottom: 16 }}
      />

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {tab === "counsel" ? (
              <tr>
                <th style={S.th} onClick={() => toggleSort("name")}>Attorney {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={S.th} onClick={() => toggleSort("firm")}>Firm</th>
                <th style={S.th} onClick={() => toggleSort("totalCases")}>Cases {sortKey === "totalCases" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={S.th} onClick={() => toggleSort("winRate")}>Our Win Rate {sortKey === "winRate" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={S.th} onClick={() => toggleSort("avgRecovery")}>Avg Recovery {sortKey === "avgRecovery" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={S.th}>Insurers</th>
              </tr>
            ) : (
              <tr>
                <th style={S.th} onClick={() => toggleSort("name")}>Judge</th>
                <th style={S.th}>Court</th>
                <th style={S.th} onClick={() => toggleSort("totalCases")}>Cases</th>
                <th style={S.th}>Settled</th>
                <th style={S.th}>Active</th>
              </tr>
            )}
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: B.txtD }}>No data found</td></tr>
            )}
            {filtered.map((row, i) => (
              <React.Fragment key={i}>
                <tr onClick={() => setExpanded(expanded === i ? null : i)}
                  style={{ cursor: "pointer", background: expanded === i ? `${B.gold}08` : "transparent" }}>
                  {tab === "counsel" ? (<>
                    <td style={{ ...S.td, color: B.txt, fontWeight: 600 }}>{row.name}</td>
                    <td style={{ ...S.td, color: B.txtM }}>{row.firm || "—"}</td>
                    <td style={{ ...S.td, ...S.mono, color: B.txt }}>{row.totalCases}</td>
                    <td style={{ ...S.td, ...S.mono, color: row.winRate >= 60 ? B.green : row.winRate >= 40 ? B.gold : B.danger }}>{row.winRate}%</td>
                    <td style={{ ...S.td, ...S.mono, color: B.green }}>{fmt(row.avgRecovery)}</td>
                    <td style={{ ...S.td, color: B.txtM, fontSize: 11 }}>{row.insurers?.slice(0, 3).join(", ")}{row.insurers?.length > 3 ? ` +${row.insurers.length - 3}` : ""}</td>
                  </>) : (<>
                    <td style={{ ...S.td, color: B.txt, fontWeight: 600 }}>{row.name}</td>
                    <td style={{ ...S.td, color: B.txtM }}>{row.court || "—"}</td>
                    <td style={{ ...S.td, ...S.mono }}>{row.totalCases}</td>
                    <td style={{ ...S.td, ...S.mono, color: B.green }}>{row.outcomes?.settled || 0}</td>
                    <td style={{ ...S.td, ...S.mono, color: B.gold }}>{row.outcomes?.active || 0}</td>
                  </>)}
                </tr>
                {expanded === i && (
                  <tr><td colSpan={6} style={{ padding: "12px 20px", background: `${B.card}` }}>
                    <div style={{ fontSize: 12, color: B.txtD, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Cases</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {row.cases.map((c, j) => (
                        <div key={j} style={{ display: "flex", gap: 16, padding: "6px 0", borderBottom: `1px solid ${B.bdr}06`, fontSize: 12 }}>
                          <span style={{ color: B.gold, ...S.mono, minWidth: 100 }}>{c.ref}</span>
                          <span style={{ color: B.txt, flex: 1 }}>{c.client}</span>
                          <span style={{ ...S.badge, background: c.status === "Settled" ? `${B.green}22` : `${B.gold}22`, color: c.status === "Settled" ? B.green : B.gold }}>{c.status}</span>
                          {c.recovery > 0 && <span style={{ ...S.mono, color: B.green }}>{fmt(c.recovery)}</span>}
                        </div>
                      ))}
                    </div>
                    {tab === "counsel" && row.phone && <div style={{ marginTop: 8, fontSize: 12, color: B.txtM }}>📞 {row.phone} {row.email && `| ✉️ ${row.email}`}</div>}
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
