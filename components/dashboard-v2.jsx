"use client";
import { useState, useEffect } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const CARD_BG = "#0a0a2e";
const CARD_BORDER = "1px solid rgba(235,176,3,0.15)";
const TEXT = "#e0e0e0";
const TEXT_DIM = "#888";
const RED = "#e53935";

const typeEmoji = { fire: "🔥", water: "💧", wind: "🌬️", hail: "🧊" };
const activityIcons = {
  note: "📝", status_change: "🔄", document: "📄", email: "✉️",
  call: "📞", payment: "💰", default: "📌",
};

function fmt$(n) {
  return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Card({ title, span, children }) {
  return (
    <div style={{
      background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 24,
      gridColumn: span ? `span ${span}` : undefined,
    }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: GOLD }}>{title}</h3>
      {children}
    </div>
  );
}

function Bar({ label, value, max, color = GOLD, onClick }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const clickable = !!onClick;
  return (
    <div style={{ marginBottom: 8, cursor: clickable ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ color: TEXT }}>{label}</span>
        <span style={{ color: TEXT_DIM }}>{value}</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 14 }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: "100%", transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function Skeleton() {
  const b = { background: "rgba(255,255,255,0.05)", borderRadius: 8, height: 120 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
      {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ ...b, animation: "pulse 1.5s infinite ease-in-out" }} />)}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  );
}

export default function DashboardV2({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedAttorney, setSelectedAttorney] = useState("");
  const [attorneys, setAttorneys] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = (attorneyId) => {
    setLoading(true);
    setError(null);
    const url = attorneyId ? `/api/dashboard?attorney_id=${attorneyId}` : "/api/dashboard";
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        setData(d);
        if (d.attorneys && !attorneys.length) setAttorneys(d.attorneys);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchDashboard(selectedAttorney); }, [selectedAttorney]);

  if (error) return <div style={{ color: RED, padding: 40, textAlign: "center" }}>Dashboard error: {error}</div>;

  const selectedName = selectedAttorney ? (attorneys.find(a => a.id === selectedAttorney)?.name || "") : "";

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: TEXT, padding: "24px 32px", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: GOLD }}>
          {selectedAttorney ? `${selectedName}'s Dashboard` : "Firm Dashboard"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: TEXT_DIM }}>View:</label>
          <select
            value={selectedAttorney}
            onChange={(e) => setSelectedAttorney(e.target.value)}
            style={{
              background: CARD_BG, color: TEXT, border: CARD_BORDER, borderRadius: 8,
              padding: "8px 12px", fontSize: 14, cursor: "pointer", minWidth: 180,
            }}
          >
            <option value="">🏢 Firm Wide</option>
            {attorneys.map(a => (
              <option key={a.id} value={a.id}>👤 {a.name}</option>
            ))}
          </select>
        </div>
      </div>
      {loading || !data ? <Skeleton /> : <Grid data={data} onNavigate={onNavigate} />}
    </div>
  );
}

function Grid({ data, onNavigate }) {
  const nav = (filter) => onNavigate && onNavigate("cases", filter);
  const {
    total_cases, cases_by_status, cases_by_type, cases_by_jurisdiction, top_insurers, sol_urgent,
    cases_opened_this_month, cases_opened_this_year, total_recovery_sum,
    total_fees_sum, cases_by_attorney, recent_activity, data_quality, comms, sol_expired,
  } = data;

  const typeMax = Math.max(...Object.values(cases_by_type || {}), 1);
  const insurerMax = top_insurers?.[0]?.count || 1;
  const attMax = cases_by_attorney?.[0]?.count || 1;

  return (
    <div className="dashboard-grid" style={{
      display: "grid", gap: 20,
      gridTemplateColumns: "repeat(3,1fr)",
    }}>
      <style>{`
        @media(max-width:1100px){.dashboard-grid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:700px){.dashboard-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Total Cases */}
      <Card title="Total Cases">
        <div style={{ fontSize: 48, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{total_cases}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {Object.entries(cases_by_status || {}).map(([s, c]) => (
            <span key={s} style={{
              background: "rgba(235,176,3,0.12)", border: "1px solid rgba(235,176,3,0.3)",
              borderRadius: 20, padding: "3px 10px", fontSize: 12, color: GOLD,
            }}>{s}: {c}</span>
          ))}
        </div>
      </Card>

      {/* SOL Alerts */}
      <Card title="SOL Alerts">
        <div style={{ fontSize: 36, fontWeight: 700, color: RED, lineHeight: 1 }}>{sol_urgent?.count || 0}</div>
        <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 12 }}>cases with SOL &lt; 30 days</div>
        <div style={{ maxHeight: 160, overflowY: "auto" }}>
          {(sol_urgent?.list || []).map((c) => (
            <a key={c.id} href={`/cases/${c.id}`} style={{
              display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)", color: TEXT, textDecoration: "none", fontSize: 13,
            }}>
              <span>{c.client_name}</span>
              <span style={{ color: c.days_remaining <= 7 ? RED : GOLD, fontWeight: 600 }}>{c.days_remaining}d</span>
            </a>
          ))}
        </div>
      </Card>

      {/* Financial Summary */}
      <Card title="Financial Summary (2026 YTD)">
        {(() => {
          const YEAR_GOAL = 30000000;
          const now = new Date();
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const dayOfYear = Math.floor((now - yearStart) / 86400000) + 1;
          const weeksElapsed = Math.max(dayOfYear / 7, 1);
          const monthsElapsed = now.getMonth() + (now.getDate() / 30);
          const weeklyGoal = YEAR_GOAL / 52;
          const monthlyGoal = YEAR_GOAL / 12;
          const weeklyRecovery = total_recovery_sum / weeksElapsed;
          const monthlyRecovery = total_recovery_sum / monthsElapsed;
          const weeklyFees = total_fees_sum / weeksElapsed;
          const monthlyFees = total_fees_sum / monthsElapsed;
          const pctGoal = Math.min((total_recovery_sum / YEAR_GOAL) * 100, 100);
          const expectedPct = (dayOfYear / 365) * 100;
          const onTrack = pctGoal >= expectedPct * 0.8;

          return (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Recovery (Settled Cases)</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: GREEN }}>{fmt$(total_recovery_sum)}</div>
                  <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 4 }}>
                    {fmt$(weeklyRecovery)}/wk · {fmt$(monthlyRecovery)}/mo
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Attorney Fees</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: GOLD }}>{fmt$(total_fees_sum)}</div>
                  <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 4 }}>
                    {fmt$(weeklyFees)}/wk · {fmt$(monthlyFees)}/mo
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: TEXT_DIM }}>2026 Goal: {fmt$(YEAR_GOAL)}</span>
                  <span style={{ color: onTrack ? GREEN : RED, fontWeight: 600 }}>{pctGoal.toFixed(1)}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 18, position: "relative" }}>
                  <div style={{ position: "absolute", left: `${expectedPct}%`, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.2)", zIndex: 1 }} title="Expected pace" />
                  <div style={{ width: `${pctGoal}%`, background: onTrack ? GREEN : RED, borderRadius: 6, height: "100%", transition: "width 0.6s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4, color: TEXT_DIM }}>
                  <span>Goal/wk: {fmt$(weeklyGoal)} · Goal/mo: {fmt$(monthlyGoal)}</span>
                  <span>{onTrack ? "✅ On track" : "⚠️ Behind pace"}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Cases by Phase */}
      <Card title="Cases by Phase">
        {(() => {
          const phaseOrder = ["Intake", "Investigation", "Presuit Demand", "Appraisal", "Litigation - Filed", "Settled", "Referred"];
          const phaseColors = { "Intake": "#ebb003", "Investigation": "#42a5f5", "Presuit Demand": "#ff9800", "Appraisal": "#ab47bc", "Litigation - Filed": "#e53935", "Settled": GREEN, "Referred": "#666" };
          const entries = phaseOrder.map(p => [p, (cases_by_status || {})[p] || 0]).filter(([,v]) => v > 0);
          const phaseMax = Math.max(...entries.map(([,v]) => v), 1);
          return entries.map(([p, v]) => <Bar key={p} label={p} value={v} max={phaseMax} color={phaseColors[p] || GOLD} onClick={() => nav({ status: p })} />);
        })()}
      </Card>

      {/* Cases by State */}
      <Card title="Cases by State">
        {(() => {
          const raw = Object.entries(cases_by_jurisdiction || {}).sort((a, b) => b[1] - a[1]);
          let otherCount = 0;
          const main = [];
          for (const [s, v] of raw) {
            if (v < 5) { otherCount += v; } else { main.push([s, v]); }
          }
          const entries = otherCount > 0 ? [...main, ["Other", otherCount]] : main;
          const stateMax = Math.max(...entries.map(([,v]) => v), 1);
          return entries.map(([s, v]) => <Bar key={s} label={s} value={v} max={stateMax} color="#42a5f5" onClick={s !== "Other" ? () => nav({ jurisdiction: s }) : undefined} />);
        })()}
      </Card>

      {/* Cases by Type */}
      <Card title="Cases by Type">
        {(() => {
          const raw = { ...(cases_by_type || {}) };
          // Merge "Property Casualty" and "Property" into "Other" since they're unclassified property cases
          if (raw["Property Casualty"]) { raw["Other"] = (raw["Other"] || 0) + raw["Property Casualty"]; delete raw["Property Casualty"]; }
          if (raw["Property"]) { raw["Other"] = (raw["Other"] || 0) + raw["Property"]; delete raw["Property"]; }
          // Remove "Investigation" if it shows as a type
          delete raw["Investigation"];
          const entries = Object.entries(raw).sort((a, b) => b[1] - a[1]);
          const mx = Math.max(...entries.map(([,v]) => v), 1);
          const emoji = { fire: "🔥", water: "💧", wind: "🌬️", hail: "🧊", "personal injury": "⚖️", other: "📋" };
          return entries.map(([t, v]) => (
            <Bar key={t} label={`${emoji[t.toLowerCase()] || "❓"} ${t}`} value={v} max={mx} color={GOLD} onClick={() => nav({ type: t })} />
          ));
        })()}
      </Card>

      {/* Top 10 Insurers */}
      <Card title="Top 10 Insurers">
        {(top_insurers || []).slice(0, 10).map((ins) => (
          <Bar key={ins.name} label={ins.name} value={ins.count} max={insurerMax} color="#5c6bc0" onClick={() => nav({ insurer: ins.name })} />
        ))}
      </Card>

      {/* Cases by Attorney */}
      <Card title="Cases by Attorney">
        {(cases_by_attorney || []).map((a) => (
          <Bar key={a.name} label={a.name} value={a.count} max={attMax} color={GREEN} onClick={() => nav({ attorney: a.name })} />
        ))}
      </Card>

      {/* Cases Opened */}
      <Card title="Cases Opened">
        <div style={{ display: "flex", gap: 32 }}>
          <div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>This Month</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: GOLD }}>{cases_opened_this_month}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>This Year</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: GREEN }}>{cases_opened_this_year}</div>
          </div>
        </div>
      </Card>

      {/* Communications */}
      <Card title="Communications">
        {(() => {
          const items = [
            { label: "📧 Emails", value: comms?.email_count || 0 },
            { label: "📞 Calls (linked)", value: `${comms?.linked_calls || 0} / ${comms?.call_count || 0}` },
            { label: "📄 Docs (linked)", value: `${comms?.linked_docs || 0} / ${comms?.doc_count || 0}` },
          ];
          return items.map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <span style={{ color: TEXT }}>{label}</span>
              <span style={{ color: GOLD, fontWeight: 600 }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
            </div>
          ));
        })()}
      </Card>

      {/* Data Quality */}
      <Card title="Data Quality">
        {(() => {
          const dq = data_quality || {};
          const items = [
            { label: "Missing SOL dates", value: dq.missing_sol || 0, color: dq.missing_sol > 10 ? RED : GOLD },
            { label: "Missing insurer", value: dq.missing_insurer || 0, color: dq.missing_insurer > 10 ? RED : GOLD },
            { label: "Expired SOL", value: sol_expired?.count || 0, color: RED },
          ];
          return items.map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <span style={{ color: TEXT }}>{label}</span>
              <span style={{ color, fontWeight: 600 }}>{value}</span>
            </div>
          ));
        })()}
      </Card>

      {/* Recent Activity */}
      <Card title="Recent Activity" span={2}>
        {(recent_activity || []).map((a, i) => (
          <div key={a.id || i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
            borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13,
          }}>
            <span style={{ fontSize: 16 }}>{activityIcons[a.action_type] || activityIcons.default}</span>
            <span style={{ flex: 1, color: TEXT }}>
              <strong>{a.case_name || "Unknown"}</strong> — {a.description || a.action_type}
            </span>
            <span style={{ color: TEXT_DIM, fontSize: 11, whiteSpace: "nowrap" }}>
              {a.created_at ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
