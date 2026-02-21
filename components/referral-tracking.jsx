"use client";
import { useState, useEffect, useMemo } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", cardH: "#16161f",
  bdr: "#1e1e2e", bdrL: "#2a2a3a",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050",
};

const CATEGORIES = [
  "Attorney Referral", "Google", "Past Client", "Social Media",
  "Website", "Word of Mouth", "Insurance Agent", "Community Event",
  "Bar Association", "Other",
];

const cardStyle = { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 };
const inputStyle = {
  background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6,
  padding: "8px 12px", color: B.txt, fontSize: 13, outline: "none",
  width: "100%", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
};
const btnStyle = {
  background: B.gold, color: "#000", border: "none", borderRadius: 6,
  padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const fmt = (n) => {
  if (!n || n === 0) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function ReferralTracking() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", contact_info: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = async () => {
    try {
      const res = await fetch("/api/referral-sources?stats=true");
      const data = await res.json();
      if (Array.isArray(data)) setSources(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "All") return sources;
    return sources.filter(s => s.category === filter);
  }, [sources, filter]);

  const totals = useMemo(() => ({
    cases: sources.reduce((s, r) => s + (r.live_cases_count || r.cases_count || 0), 0),
    recovery: sources.reduce((s, r) => s + (r.live_total_recovery || r.total_recovery || 0), 0),
    sources: sources.length,
  }), [sources]);

  const addSource = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/referral-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: "", category: "", contact_info: "", notes: "" });
        setShowAdd(false);
        load();
      }
    } catch {}
    setSaving(false);
  };

  const deleteSource = async (id) => {
    if (!confirm("Delete this referral source?")) return;
    await fetch(`/api/referral-sources?id=${id}`, { method: "DELETE" });
    load();
  };

  const categories = useMemo(() => {
    const cats = new Set(sources.map(s => s.category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [sources]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading referral data...</div>;
  }

  return (
    <div style={{ padding: 24, color: B.txt }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🤝 Referral Sources</h1>
          <p style={{ color: B.txtM, margin: "4px 0 0", fontSize: 13 }}>Track where your cases come from</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={btnStyle}>
          {showAdd ? "Cancel" : "+ Add Source"}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Sources", value: totals.sources, icon: "📋" },
          { label: "Cases Referred", value: totals.cases, icon: "📁" },
          { label: "Total Recovery", value: fmt(totals.recovery), icon: "💰" },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: B.gold }}>{s.value}</div>
            <div style={{ fontSize: 11, color: B.txtM, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div style={{ ...cardStyle, marginBottom: 24, border: `1px solid ${B.gold}40` }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, color: B.gold }}>Add Referral Source</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: B.txtM, marginBottom: 4, display: "block" }}>Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Smith, Esq." />
            </div>
            <div>
              <label style={{ fontSize: 11, color: B.txtM, marginBottom: 4, display: "block" }}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: B.txtM, marginBottom: 4, display: "block" }}>Contact Info</label>
              <input style={inputStyle} value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} placeholder="Phone or email" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: B.txtM, marginBottom: 4, display: "block" }}>Notes</label>
              <input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" />
            </div>
          </div>
          <button onClick={addSource} disabled={saving} style={{ ...btnStyle, marginTop: 12 }}>
            {saving ? "Saving..." : "Save Source"}
          </button>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{
            padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: filter === c ? `${B.gold}20` : "transparent",
            color: filter === c ? B.gold : B.txtM,
            border: `1px solid ${filter === c ? B.gold + "40" : B.bdr}`,
          }}>{c}</button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>🏆 Referral Leaderboard</h3>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: B.txtD }}>
            No referral sources yet. Add one to get started!
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${B.bdr}` }}>
                {["#", "Source", "Category", "Cases", "Recovery", "Avg Recovery", "Conv. Rate", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const cases = s.live_cases_count || s.cases_count || 0;
                const recovery = s.live_total_recovery || s.total_recovery || 0;
                const avg = s.avg_recovery || 0;
                const conv = s.conversion_rate || "0.0";
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${B.bdr}20` }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: B.txtD, fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                      {s.contact_info && <div style={{ fontSize: 11, color: B.txtD }}>{s.contact_info}</div>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, background: `${B.navy}30`, color: "#8888cc" }}>
                        {s.category || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: B.txt }}>{cases}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: B.green }}>{fmt(recovery)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: B.txtM }}>{fmt(avg)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: parseFloat(conv) > 50 ? B.green : B.gold }}>{conv}%</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => deleteSource(s.id)} style={{ background: "none", border: "none", color: B.txtD, cursor: "pointer", fontSize: 14 }} title="Delete">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Category Breakdown */}
      {sources.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>📊 By Category</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {Object.entries(
              sources.reduce((acc, s) => {
                const cat = s.category || "Uncategorized";
                if (!acc[cat]) acc[cat] = { cases: 0, recovery: 0, count: 0 };
                acc[cat].cases += s.live_cases_count || s.cases_count || 0;
                acc[cat].recovery += s.live_total_recovery || s.total_recovery || 0;
                acc[cat].count++;
                return acc;
              }, {})
            ).sort((a, b) => b[1].cases - a[1].cases).map(([cat, data]) => (
              <div key={cat} style={{ background: `${B.navy}15`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: B.txtM, marginBottom: 6 }}>{cat}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: B.gold }}>{data.cases} cases</div>
                <div style={{ fontSize: 12, color: B.green }}>{fmt(data.recovery)}</div>
                <div style={{ fontSize: 11, color: B.txtD }}>{data.count} source{data.count !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
