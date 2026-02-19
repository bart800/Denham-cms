"use client";
import { useState, useEffect, useMemo, Fragment } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", border: "#1e1e2e",
  text: "#e8e8f0", textMuted: "#8888a0", textDim: "#55556a",
  danger: "#e04050",
};

const mono = { fontFamily: "'JetBrains Mono',monospace" };

function fmt$(v) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

export default function InsuranceAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("totalCases");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/analytics/insurers");
        const json = await resp.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    if (!data?.insurers) return [];
    const list = [...data.insurers];
    list.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = -Infinity;
      if (bv == null) bv = -Infinity;
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [data, sortKey, sortAsc]);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 14, color: B.textMuted }}>Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, color: B.danger }}>{error}</div>
      </div>
    );
  }

  const s = data.summary;
  const arrow = (key) => sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  const columns = [
    { key: "insurer", label: "Insurer", align: "left" },
    { key: "totalCases", label: "Cases", align: "right" },
    { key: "denialRate", label: "Denial Rate", align: "right" },
    { key: "avgDaysToSettle", label: "Avg Days", align: "right" },
    { key: "totalRecovery", label: "Total Recovery", align: "right" },
    { key: "avgRecovery", label: "Avg Recovery", align: "right" },
    { key: "winRate", label: "Win Rate", align: "right" },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: B.text }}>
        📊 Insurance Company Analytics
      </h2>

      {/* Summary Bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24,
      }}>
        {[
          { label: "Total Insurers", value: s.totalInsurers, color: B.navy },
          { label: "Total Cases", value: s.totalCases, color: B.gold },
          { label: "Avg Recovery", value: fmt$(s.avgRecovery), color: B.green },
          { label: "Overall Denial Rate", value: fmtPct(s.overallDenialRate), color: B.danger },
        ].map((item, i) => (
          <div key={i} style={{
            background: B.card, border: `1px solid ${B.border}`, borderRadius: 10,
            padding: "16px 20px",
          }}>
            <div style={{ fontSize: 11, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              {item.label}
            </div>
            <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: B.card, border: `1px solid ${B.border}`, borderRadius: 10,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    textAlign: col.align, padding: "12px 16px",
                    borderBottom: `1px solid ${B.border}`,
                    color: sortKey === col.key ? B.gold : B.textDim,
                    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: 0.5, cursor: "pointer", userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}{arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isExp = expanded === row.insurer;
              return (
                <Fragment key={row.insurer}>
                  <tr
                    onClick={() => setExpanded(isExp ? null : row.insurer)}
                    style={{
                      cursor: "pointer",
                      background: isExp ? `${B.gold}08` : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!isExp) e.currentTarget.style.background = `${B.border}40`; }}
                    onMouseLeave={(e) => { if (!isExp) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, color: B.text, fontWeight: 600 }}>
                      {isExp ? "▼" : "▶"} {row.insurer}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, textAlign: "right", ...mono, color: B.text }}>
                      {row.totalCases}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, textAlign: "right", ...mono, color: row.denialRate > 0.5 ? B.danger : B.textMuted }}>
                      {fmtPct(row.denialRate)}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, textAlign: "right", ...mono, color: B.textMuted }}>
                      {row.avgDaysToSettle ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, textAlign: "right", ...mono, color: B.green }}>
                      {fmt$(row.totalRecovery)}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, textAlign: "right", ...mono, color: B.green }}>
                      {fmt$(row.avgRecovery)}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}06`, textAlign: "right", ...mono, color: row.winRate != null && row.winRate >= 0.5 ? B.green : B.textMuted }}>
                      {fmtPct(row.winRate)}
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 16px 16px 48px", borderBottom: `1px solid ${B.border}`, background: `${B.navy}10` }}>
                        <div style={{ paddingTop: 12 }}>
                          <div style={{ fontSize: 11, color: B.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                            Case Breakdown by Status
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {Object.entries(row.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                              <div key={status} style={{
                                padding: "6px 12px", borderRadius: 6,
                                background: B.bg, border: `1px solid ${B.border}`,
                                fontSize: 12, color: B.text,
                              }}>
                                <span style={{ color: B.textMuted }}>{status}:</span>{" "}
                                <span style={{ ...mono, fontWeight: 600 }}>{count}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 12 }}>
                            <span style={{ color: B.textMuted }}>
                              Settled: <span style={{ ...mono, color: B.green }}>{row.settledCount}</span>
                            </span>
                            <span style={{ color: B.textMuted }}>
                              Denied: <span style={{ ...mono, color: B.danger }}>{row.deniedCount}</span>
                            </span>
                            <span style={{ color: B.textMuted }}>
                              Closed ($0): <span style={{ ...mono, color: B.textDim }}>{row.closedZeroCount}</span>
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Need Fragment import
import { Fragment } from "react";
