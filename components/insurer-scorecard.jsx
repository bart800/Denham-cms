"use client";
import { useState, useEffect } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050",
};
const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 },
  btn: { background: B.gold, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnO: { background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: B.txtM, fontFamily: "'DM Sans',sans-serif" },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
};

const fmt$ = v => v == null ? "—" : "$" + Number(v).toLocaleString();
const fmtPct = v => v == null ? "—" : (v * 100).toFixed(1) + "%";

function ScorecardPanel({ name, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/analytics/insurer/${encodeURIComponent(name)}`);
        const d = await r.json();
        setData(d);
      } catch {}
      setLoading(false);
    })();
  }, [name]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading scorecard for {name}...</div>;
  if (!data || !data.stats) return <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No data for {name}</div>;

  const s = data.stats;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: B.txt }}>{name}</h3>
          <div style={{ fontSize: 12, color: B.txtM, marginTop: 2 }}>{s.totalCases} cases · {s.settledCount} settled</div>
        </div>
        {onClose && <button onClick={onClose} style={S.btnO}>← Back</button>}
      </div>

      {/* Key Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Denial Rate", v: fmtPct(s.denialRate), c: s.denialRate > 0.3 ? B.danger : s.denialRate > 0.15 ? B.gold : B.green },
          { l: "Avg Recovery", v: fmt$(s.avgRecovery), c: B.green },
          { l: "Avg Days to Settle", v: s.avgTimeToSettle ? `${s.avgTimeToSettle}d` : "—", c: s.avgTimeToSettle > 180 ? B.danger : s.avgTimeToSettle > 90 ? B.gold : B.green },
          { l: "Total Recovery", v: fmt$(s.totalRecovery), c: B.gold },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 22, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Case Outcomes */}
        <div style={S.card}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: B.txt }}>Case Outcomes</h4>
          {Object.entries(s.outcomes || {}).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${B.bdr}06` }}>
              <span style={{ fontSize: 13, color: B.txtM }}>{status}</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.txt }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Denial Reasons */}
        <div style={S.card}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: B.txt }}>Denial Reasons</h4>
          {Object.keys(s.denialReasons || {}).length === 0 ? (
            <div style={{ fontSize: 13, color: B.txtD }}>No denials recorded</div>
          ) : Object.entries(s.denialReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
            <div key={reason} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${B.bdr}06` }}>
              <span style={{ fontSize: 13, color: B.txtM }}>{reason}</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.danger }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Adjuster Roster */}
        <div style={S.card}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: B.txt }}>Adjuster Roster</h4>
          {(s.adjusters || []).length === 0 ? (
            <div style={{ fontSize: 13, color: B.txtD }}>No adjusters recorded</div>
          ) : s.adjusters.sort((a, b) => b.cases - a.cases).map((adj, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${B.bdr}06` }}>
              <div>
                <div style={{ fontSize: 13, color: B.txt }}>{adj.name}</div>
                {(adj.phone || adj.email) && <div style={{ fontSize: 11, color: B.txtD }}>{adj.phone} {adj.email}</div>}
              </div>
              <span style={{ ...S.mono, fontSize: 12, color: B.txtM }}>{adj.cases} cases</span>
            </div>
          ))}
        </div>

        {/* By Jurisdiction */}
        <div style={S.card}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: B.txt }}>By Jurisdiction</h4>
          {Object.entries(s.byJurisdiction || {}).sort((a, b) => b[1] - a[1]).map(([j, count]) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${B.bdr}06` }}>
              <span style={{ fontSize: 13, color: B.txtM }}>{j}</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.txt }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: B.txt }}>Cases ({data.cases.length})</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>{["Ref", "Client", "Status", "Jurisdiction", "DOL"].map((h, i) => (
              <th key={i} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data.cases.slice(0, 20).map(c => (
              <tr key={c.id}>
                <td style={{ padding: "8px 12px", ...S.mono, color: B.gold }}>{c.ref}</td>
                <td style={{ padding: "8px 12px", color: B.txt }}>{c.client_name}</td>
                <td style={{ padding: "8px 12px", color: B.txtM }}>{c.status}</td>
                <td style={{ padding: "8px 12px", color: B.txtM }}>{c.jurisdiction}</td>
                <td style={{ padding: "8px 12px", ...S.mono, color: B.txtD }}>{c.date_of_loss || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InsurerScorecard({ insurerName, onClose }) {
  const [compare, setCompare] = useState(false);
  const [compareName, setCompareName] = useState("");
  const [insurers, setInsurers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/analytics/insurers");
        const d = await r.json();
        if (d.insurers) setInsurers(d.insurers.map(i => i.name));
      } catch {}
    })();
  }, []);

  if (compare && compareName) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.gold }}>⚖️ Side-by-Side Comparison</h3>
          <button onClick={() => { setCompare(false); setCompareName(""); }} style={S.btnO}>← Back</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <ScorecardPanel name={insurerName} />
          <ScorecardPanel name={compareName} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <select value={compareName} onChange={e => setCompareName(e.target.value)}
          style={{ ...S.btnO, appearance: "auto", padding: "6px 12px", minWidth: 200 }}>
          <option value="">Compare with...</option>
          {insurers.filter(n => n !== insurerName).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {compareName && <button onClick={() => setCompare(true)} style={S.btn}>⚖️ Compare</button>}
      </div>
      <ScorecardPanel name={insurerName} onClose={onClose} />
    </div>
  );
}
