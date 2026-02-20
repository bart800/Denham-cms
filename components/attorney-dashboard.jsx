"use client";
import { useState, useEffect } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050", purple: "#7c5cbf",
};

const S = {
  btn: { background: B.gold, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnO: { background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: B.txtM, fontFamily: "'DM Sans',sans-serif" },
  input: { background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "6px 10px", color: B.txt, fontSize: 12, outline: "none", fontFamily: "'DM Sans',sans-serif" },
};

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

const PHASE_COLORS = {
  "Presuit": "#4a90d9", "Presuit": "#7c5cbf", "Presuit": B.gold,
  "Presuit": "#e08040", "Litigation - Filed": B.danger,
  "Litigation - Discovery": "#d94a7a", "Litigation - Mediation": "#9b59b6",
  "Litigation - Trial Prep": "#c0392b", "Appraisal": "#2ecc71", "Settled": B.green,
};

export default function AttorneyDashboard({ onNavigateCase }) {
  const [attorneys, setAttorneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState(null);
  const [newAtty, setNewAtty] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/attorneys/caseload")
      .then(r => r.json())
      .then(d => setAttorneys(d.attorneys || []))
      .catch(() => setAttorneys([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reassign = async (caseId) => {
    if (!newAtty) return;
    await fetch("/api/attorneys/caseload", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, newAttorney: newAtty }),
    });
    setReassigning(null); setNewAtty(""); load();
  };

  const attyNames = attorneys.map(a => a.name).filter(n => n !== "Unassigned");

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading attorney caseload...</div>;

  // Summary stats
  const totalCases = attorneys.reduce((s, a) => s + a.activeCases, 0);
  const totalSettled = attorneys.reduce((s, a) => s + (a.performance?.settledCount || 0), 0);
  const totalRecovery = attorneys.reduce((s, a) => s + (a.performance?.totalRecovery || 0), 0);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: B.txt }}>👨‍⚖️ Attorney Dashboard</h2>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Active" value={totalCases} color={B.gold} />
        <StatCard label="Attorneys" value={attorneys.filter(a => a.name !== "Unassigned").length} color={B.navy === "#000066" ? "#6666ff" : B.navy} />
        <StatCard label="Total Settled" value={totalSettled} color={B.green} />
        <StatCard label="Total Recovery" value={fmt(totalRecovery)} color={B.green} />
      </div>

      {/* Attorney Cards */}
      {attorneys.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No cases found.</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {attorneys.map(a => (
            <div key={a.name} style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 }}>
              {/* Attorney Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.txt }}>{a.name}</h3>
                  <div style={{ fontSize: 12, color: B.txtM, marginTop: 2 }}>
                    {a.activeCases} active cases · Avg age: {a.avgAge} days
                  </div>
                </div>
                {a.performance?.settledCount > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: B.txtD }}>Performance</div>
                    <div style={{ fontSize: 13, color: B.green, fontWeight: 600 }}>{a.performance.settledCount} settled · {fmt(a.performance.totalRecovery)}</div>
                    <div style={{ fontSize: 11, color: B.txtM }}>Avg {a.performance.avgDaysToSettle}d to settle</div>
                  </div>
                )}
              </div>

              {/* Phase Distribution */}
              {Object.keys(a.phases).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: B.txtD, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Case Distribution</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(a.phases).map(([phase, count]) => (
                      <span key={phase} style={{
                        padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: `${PHASE_COLORS[phase] || B.txtD}20`,
                        color: PHASE_COLORS[phase] || B.txtM,
                      }}>
                        {phase}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cases Table */}
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Cases</div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 10, fontWeight: 600 }}>Client</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 10, fontWeight: 600 }}>Ref</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 10, fontWeight: 600 }}>Status</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 10, fontWeight: 600 }}>Age</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 10, fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.cases.map(c => (
                      <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => onNavigateCase && onNavigateCase(c.id)}>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${B.bdr}06`, color: B.txt }}>{c.client_name}</td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${B.bdr}06`, color: B.gold, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{c.ref || c.case_ref}</td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${B.bdr}06` }}>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, background: `${PHASE_COLORS[c.status] || B.txtD}20`, color: PHASE_COLORS[c.status] || B.txtM }}>{c.status}</span>
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${B.bdr}06`, textAlign: "right", color: B.txtM }}>{c.age}d</td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${B.bdr}06`, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          {reassigning === c.id ? (
                            <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                              <select value={newAtty} onChange={e => setNewAtty(e.target.value)} style={{ ...S.input, width: 120, fontSize: 10 }}>
                                <option value="">Select...</option>
                                {attyNames.filter(n => n !== a.name).map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <button onClick={() => reassign(c.id)} style={{ ...S.btn, fontSize: 10, padding: "3px 8px" }}>✓</button>
                              <button onClick={() => setReassigning(null)} style={{ ...S.btnO, fontSize: 10, padding: "3px 8px" }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setReassigning(c.id); setNewAtty(""); }} style={{ ...S.btnO, fontSize: 10, padding: "3px 8px" }}>Reassign</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#111119", border: "1px solid #1e1e2e", borderRadius: 10, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#55556a", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#e8e8f0", fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
    </div>
  );
}

