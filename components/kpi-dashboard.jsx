"use client";
import { useState, useEffect, useMemo } from "react";

const B = {
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  gold: "#ebb003", txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  navy: "#000066", green: "#386f4a", danger: "#e04050",
};

const CATEGORIES = [
  { key: "Marketing/Intake", icon: "📞", label: "Marketing / Intake" },
  { key: "Demands", icon: "📨", label: "Demands" },
  { key: "Complaints", icon: "⚖️", label: "Complaints" },
  { key: "Discovery", icon: "🔎", label: "Discovery" },
  { key: "Drafting", icon: "✏️", label: "Drafting" },
  { key: "Updates", icon: "📱", label: "Updates" },
  { key: "Settlements", icon: "💰", label: "Settlements" },
];

const METRIC_LABELS = {
  leads: "Leads",
  cases_signed: "Cases Signed",
  new_referral_interactions: "New Referral Interactions",
  presuit_demands_sent: "Presuit Demands Sent",
  settlement_offers: "Settlement Offers",
  complaints_filed: "Complaints Filed",
  discovery_served: "Discovery Served",
  discovery_drafted: "Discovery Drafted",
  complaints_drafted: "Complaints Drafted",
  demands_drafted: "Demands Drafted",
  client_updates: "Client Updates",
  referral_source_updates: "Referral Source Updates",
  cases_settled: "Cases Settled",
  undisputed_payments: "Undisputed Payments",
};

const MANUAL_METRICS = ["referral_source_updates", "new_referral_interactions", "undisputed_payments"];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

function formatWeek(ws) {
  const d = new Date(ws + "T12:00:00");
  const end = new Date(d); end.setDate(end.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(d)} – ${fmt(end)}`;
}

export default function KpiDashboard() {
  const [view, setView] = useState("admin");
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [memberId, setMemberId] = useState(null);
  const [members, setMembers] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ytdMode, setYtdMode] = useState(false);
  const [manualMetric, setManualMetric] = useState(MANUAL_METRICS[0]);
  const [manualValue, setManualValue] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualEntries, setManualEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/team/members").then(r => r.json()).then(j => setMembers(j.members || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ view, week: weekStart });
    if (memberId) params.set("member_id", memberId);
    fetch(`/api/kpi?${params}`).then(r => r.json()).then(j => { setData(j); setLoading(false); }).catch(() => setLoading(false));
  }, [view, weekStart, memberId]);

  useEffect(() => {
    fetch(`/api/kpi/manual?week_start=${weekStart}`).then(r => r.json()).then(j => setManualEntries(j.entries || [])).catch(() => {});
  }, [weekStart]);

  const shiftWeek = (dir) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(getMonday(d));
  };

  const metricsGrouped = useMemo(() => {
    if (!data?.metrics) return {};
    const g = {};
    data.metrics.forEach(m => {
      if (!g[m.category]) g[m.category] = [];
      g[m.category].push(m);
    });
    return g;
  }, [data]);

  const submitManual = async () => {
    setSaving(true);
    try {
      await fetch("/api/kpi/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric: manualMetric, week_start: weekStart, actual_value: Number(manualValue), member_id: memberId, notes: manualNotes }),
      });
      setManualValue("");
      setManualNotes("");
      // Refresh
      const params = new URLSearchParams({ view, week: weekStart });
      if (memberId) params.set("member_id", memberId);
      const r = await fetch(`/api/kpi?${params}`);
      setData(await r.json());
      const r2 = await fetch(`/api/kpi/manual?week_start=${weekStart}`);
      setManualEntries((await r2.json()).entries || []);
    } catch {}
    setSaving(false);
  };

  const enteredManuals = new Set(manualEntries.map(e => e.metric));
  const missingManuals = MANUAL_METRICS.filter(m => !enteredManuals.has(m));

  const progressColor = (pct) => pct >= 100 ? B.green : pct >= 50 ? B.gold : B.danger;
  const trendIcon = (t) => t === "up" ? "↑" : t === "down" ? "↓" : "→";
  const trendColor = (t) => t === "up" ? B.green : t === "down" ? B.danger : B.txtD;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: B.txt, margin: 0 }}>📊 KPI Dashboard</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${B.bdr}` }}>
            {["admin", "individual"].map(v => (
              <button key={v} onClick={() => { setView(v); if (v === "admin") setMemberId(null); }}
                style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: view === v ? B.gold : B.card, color: view === v ? "#000" : B.txtM }}>
                {v === "admin" ? "Firm Overview" : "Individual"}
              </button>
            ))}
          </div>
          {view === "individual" && (
            <select value={memberId || ""} onChange={e => setMemberId(e.target.value || null)}
              style={{ padding: "6px 10px", fontSize: 12, background: B.card, color: B.txt, border: `1px solid ${B.bdr}`, borderRadius: 8 }}>
              <option value="">Select member...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          {/* YTD toggle */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${B.bdr}` }}>
            {[false, true].map(y => (
              <button key={String(y)} onClick={() => setYtdMode(y)}
                style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: ytdMode === y ? B.navy : B.card, color: ytdMode === y ? "#7788ff" : B.txtM }}>
                {y ? "YTD" : "This Week"}
              </button>
            ))}
          </div>
          {/* Week nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => shiftWeek(-1)} style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 6, color: B.txt, cursor: "pointer", padding: "4px 8px", fontSize: 14 }}>◀</button>
            <span style={{ fontSize: 12, color: B.txtM, minWidth: 140, textAlign: "center" }}>{formatWeek(weekStart)}</span>
            <button onClick={() => shiftWeek(1)} style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 6, color: B.txt, cursor: "pointer", padding: "4px 8px", fontSize: 14 }}>▶</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: B.txtM }}>Loading KPIs...</div>
      ) : (
        <>
          {/* KPI Cards by Category */}
          {CATEGORIES.map(cat => {
            const metrics = metricsGrouped[cat.key];
            if (!metrics || metrics.length === 0) return null;
            return (
              <div key={cat.key} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: B.txtM, margin: "0 0 10px 0" }}>{cat.icon} {cat.label}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {metrics.map(m => {
                    const val = ytdMode ? m.ytd_actual : m.actual;
                    const tgt = ytdMode ? m.ytd_target : m.weekly_target;
                    const pct = tgt > 0 ? Math.round((val / tgt) * 100) : 0;
                    return (
                      <div key={m.metric} style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                          <div style={{ fontSize: 12, color: B.txtM, fontWeight: 600 }}>{METRIC_LABELS[m.metric] || m.metric}</div>
                          <span style={{ fontSize: 14, color: trendColor(m.trend) }}>{trendIcon(m.trend)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: B.txt }}>{val}</span>
                          <span style={{ fontSize: 14, color: B.txtD }}>/ {tgt}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: B.bdr, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: progressColor(pct), borderRadius: 4, transition: "width 0.3s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: progressColor(pct), fontWeight: 700 }}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* YTD Cumulative Tracker */}
          {ytdMode && data?.metrics && (
            <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: B.txt, margin: "0 0 16px 0" }}>📈 YTD Cumulative Progress</h3>
              {data.metrics.map(m => {
                const pct = m.ytd_target > 0 ? Math.round((m.ytd_actual / m.ytd_target) * 100) : 0;
                return (
                  <div key={m.metric} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 160, fontSize: 11, color: B.txtM, textAlign: "right", flexShrink: 0 }}>{METRIC_LABELS[m.metric]}</div>
                    <div style={{ flex: 1, position: "relative", height: 18, background: B.bdr, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${Math.min(pct, 100)}%`, background: progressColor(pct), borderRadius: 4, transition: "width 0.3s" }} />
                      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{m.ytd_actual} / {m.ytd_target}</div>
                    </div>
                    <div style={{ width: 40, fontSize: 11, fontWeight: 700, color: progressColor(pct) }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual Entry */}
          <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: B.txt, margin: "0 0 12px 0" }}>✏️ Manual Entry</h3>
            {missingManuals.length > 0 && (
              <div style={{ fontSize: 11, color: B.gold, marginBottom: 10 }}>
                ⚠️ Missing entries this week: {missingManuals.map(m => METRIC_LABELS[m]).join(", ")}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, marginBottom: 4 }}>Metric</div>
                <select value={manualMetric} onChange={e => setManualMetric(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 12, background: B.bg, color: B.txt, border: `1px solid ${B.bdr}`, borderRadius: 6 }}>
                  {MANUAL_METRICS.map(m => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, marginBottom: 4 }}>Value</div>
                <input type="number" value={manualValue} onChange={e => setManualValue(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 12, background: B.bg, color: B.txt, border: `1px solid ${B.bdr}`, borderRadius: 6, width: 70 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, marginBottom: 4 }}>Notes</div>
                <input type="text" value={manualNotes} onChange={e => setManualNotes(e.target.value)} placeholder="Optional"
                  style={{ padding: "6px 10px", fontSize: 12, background: B.bg, color: B.txt, border: `1px solid ${B.bdr}`, borderRadius: 6, width: 160 }} />
              </div>
              <button onClick={submitManual} disabled={saving || !manualValue}
                style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: B.gold, color: "#000", border: "none", borderRadius: 6, cursor: "pointer", opacity: saving || !manualValue ? 0.5 : 1 }}>
                {saving ? "..." : "Save"}
              </button>
            </div>
            {manualEntries.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {manualEntries.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: B.txtM, padding: "3px 0" }}>
                    {METRIC_LABELS[e.metric] || e.metric}: <strong style={{ color: B.txt }}>{e.actual_value}</strong>
                    {e.notes && <span style={{ color: B.txtD }}> — {e.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard (admin only) */}
          {view === "admin" && members.length > 0 && (
            <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: B.txt, margin: "0 0 12px 0" }}>🏆 Team Leaderboard</h3>
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 8 }}>Based on assigned tasks and cases for the week</div>
              {members.slice(0, 10).map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < members.length - 1 ? `1px solid ${B.bdr}` : "none" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: i === 0 ? B.gold : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : B.txtD, width: 24 }}>#{i + 1}</span>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: B.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#7788ff" }}>
                    {m.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.txt }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: B.txtD }}>{m.title || m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
