"use client";
import { useState, useEffect } from "react";
import TeamInvitePanel from "./team-invite-panel";
import dynamic from "next/dynamic";
const WorkflowAdmin = dynamic(() => import("./workflow-admin"), { ssr: false, loading: () => <div style={{ color: "#999", padding: 40, textAlign: "center" }}>Loading workflow admin...</div> });

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const BG = "#0a0a1a";
const CARD = "#111133";
const BORDER = "#222255";
const TEXT = "#e0e0e0";
const MUTED = "#999";

const STATUSES = [
  { label: "Active", color: GREEN },
  { label: "Pending", color: GOLD },
  { label: "Closed", color: "#888" },
  { label: "Discovery", color: "#4a90d9" },
  { label: "Litigation", color: "#d94a4a" },
  { label: "Settlement", color: "#9b59b6" },
  { label: "Pre-Litigation", color: "#e67e22" },
  { label: "Presuit", color: "#1abc9c" },
];

const tabStyle = (active) => ({
  padding: "10px 20px",
  background: active ? NAVY : "transparent",
  color: active ? GOLD : MUTED,
  border: "none",
  borderBottom: active ? `3px solid ${GOLD}` : "3px solid transparent",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: active ? 700 : 400,
});

const cardStyle = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

const inputStyle = {
  background: "#1a1a3a",
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: "8px 12px",
  color: TEXT,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const btnStyle = {
  background: GOLD,
  color: "#000",
  border: "none",
  borderRadius: 6,
  padding: "10px 20px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

function formatBytes(b) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + " " + u[i];
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "Paralegal", color: GOLD });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const removeMember = async (member) => {
    if (!confirm(`Remove ${member.name}? This will unassign them from all cases and tasks.`)) return;
    setRemoving(member.id);
    try {
      const res = await fetch(`/api/settings?id=${member.id}`, { method: "DELETE" });
      if (res.ok) {
        const fresh = await fetch("/api/settings").then((r) => r.json());
        setData(fresh);
      } else {
        const err = await res.json();
        alert("Failed to remove: " + (err.error || "Unknown error"));
      }
    } finally {
      setRemoving(null);
    }
  };

  const addMember = async () => {
    if (!newMember.name || !newMember.email) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });
      if (res.ok) {
        const fresh = await fetch("/api/settings").then((r) => r.json());
        setData(fresh);
        setNewMember({ name: "", email: "", role: "Paralegal", color: GOLD });
      }
    } finally {
      setSaving(false);
    }
  };

  const exportData = async (format) => {
    const res = await fetch("/api/cases");
    const json = await res.json();
    const cases = json.cases || json.data || json || [];
    if (format === "json") {
      const blob = new Blob([JSON.stringify(cases, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cases-export.json";
      a.click();
    } else {
      if (!cases.length) return;
      const keys = Object.keys(cases[0]);
      const csv = [keys.join(","), ...cases.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cases-export.csv";
      a.click();
    }
  };

  const tabs = ["Team", "Workflows", "Statuses", "Firm Info", "Data Stats", "Import/Export", "System Health"];

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, padding: 24 }}>
      <h1 style={{ color: GOLD, marginBottom: 4 }}>âš™ï¸ Settings</h1>
      <p style={{ color: MUTED, marginTop: 0, marginBottom: 24 }}>Administration &amp; configuration</p>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
        {tabs.map((t, i) => (
          <button key={t} style={tabStyle(tab === i)} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* Team Management */}
      {tab === 0 && (
        <div>
          <div style={cardStyle}>
            <h3 style={{ color: GOLD, marginTop: 0 }}>Team Members</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Name", "Email", "Role", "Color", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: MUTED, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.team_members || []).map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 12px" }}>{m.name}</td>
                    <td style={{ padding: "10px 12px", color: MUTED }}>{m.email}</td>
                    <td style={{ padding: "10px 12px" }}>{m.role}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: m.color || GOLD, verticalAlign: "middle" }} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => removeMember(m)} disabled={removing === m.id}
                        style={{ background: "transparent", border: `1px solid #e04050`, borderRadius: 6, padding: "4px 12px", color: "#e04050", fontSize: 12, cursor: "pointer", opacity: removing === m.id ? 0.5 : 1 }}>
                        {removing === m.id ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!(data?.team_members?.length) && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: MUTED }}>No team members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={cardStyle}>
            <h3 style={{ color: GOLD, marginTop: 0 }}>Add Team Member</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <input style={inputStyle} placeholder="Name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} />
              <input style={inputStyle} placeholder="Email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} />
              <select style={inputStyle} value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}>
                {["Attorney", "Paralegal", "Admin", "Legal Assistant", "Of Counsel"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <input style={inputStyle} type="color" value={newMember.color} onChange={(e) => setNewMember({ ...newMember, color: e.target.value })} />
            </div>
            <button style={btnStyle} onClick={addMember} disabled={saving}>{saving ? "Adding..." : "Add Member"}</button>
          </div>
          <TeamInvitePanel />
        </div>
      )}

      {/* Workflows Admin */}
      {tab === 1 && (
        <WorkflowAdmin />
      )}

      {/* Case Statuses */}
      {tab === 2 && (
        <div style={cardStyle}>
          <h3 style={{ color: GOLD, marginTop: 0 }}>Case Statuses</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {STATUSES.map((s) => (
              <div key={s.label} style={{ background: "#1a1a3a", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${BORDER}` }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{s.label}</span>
                {data?.cases_by_status?.[s.label] != null && (
                  <span style={{ marginLeft: "auto", color: MUTED, fontSize: 13 }}>{data.cases_by_status[s.label]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Firm Info */}
      {tab === 3 && (
        <div style={cardStyle}>
          <h3 style={{ color: GOLD, marginTop: 0 }}>ðŸ›ï¸ Firm Information</h3>
          <div style={{ lineHeight: 2 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: GOLD, marginBottom: 8 }}>Denham Property and Injury Law Firm</div>
            <div>ðŸ" 250 W. Main St. Suite 120, Lexington, KY 40507</div>
            <div>ðŸ"ž 859-900-2278</div>
            <div>ðŸŒ <a href="https://www.denim.law" style={{ color: GOLD }} target="_blank" rel="noreferrer">www.denim.law</a></div>
          </div>
        </div>
      )}

      {/* Data Stats */}
      {tab === 4 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Total Cases", value: data?.case_count ?? "â€"", color: GOLD },
              { label: "Total Documents", value: data?.document_count ?? "â€"", color: GREEN },
              { label: "Storage", value: formatBytes(data?.storage_bytes), color: "#4a90d9" },
            ].map((s) => (
              <div key={s.label} style={{ ...cardStyle, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={cardStyle}>
            <h3 style={{ color: GOLD, marginTop: 0 }}>Cases by Status</h3>
            {Object.entries(data?.cases_by_status || {}).map(([status, count]) => (
              <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                <span>{status}</span>
                <span style={{ color: GOLD, fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
          <div style={{ ...cardStyle, color: MUTED, fontSize: 13 }}>
            Last fetched: {data?.fetched_at ? new Date(data.fetched_at).toLocaleString() : "â€""}
          </div>
        </div>
      )}

      {/* Import/Export */}
      {tab === 5 && (
        <div style={cardStyle}>
          <h3 style={{ color: GOLD, marginTop: 0 }}>ðŸ"¦ Export Data</h3>
          <p style={{ color: MUTED }}>Download all case data in your preferred format.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={btnStyle} onClick={() => exportData("csv")}>â¬‡ Export CSV</button>
            <button style={{ ...btnStyle, background: GREEN, color: "#fff" }} onClick={() => exportData("json")}>â¬‡ Export JSON</button>
          </div>
        </div>
      )}

      {tab === 6 && <SystemHealthCard />}
    </div>
  );
}

function SystemHealthCard() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/backup-status");
      const data = await res.json();
      setHealth(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/admin/backup-verify");
      const data = await res.json();
      setHealth(prev => ({ ...prev, last_verification: data }));
      load();
    } catch {}
    setVerifying(false);
  };

  const CARD = "#111133";
  const BORDER = "#222255";
  const GOLD = "#ebb003";
  const GREEN = "#386f4a";
  const MUTED = "#999";
  const TEXT = "#e0e0e0";

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: MUTED }}>Checking system health...</div>;

  const statusColor = health?.status === "healthy" || health?.status === "ok" ? GREEN : health?.status === "degraded" || health?.status === "warning" ? GOLD : "#e04050";
  const statusLabel = health?.status === "healthy" || health?.status === "ok" ? "✅ Healthy" : health?.status === "degraded" ? "⚠️ Degraded" : "❌ Error";

  return (
    <div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: GOLD, margin: 0 }}>🛡️ System Health</h3>
          <button onClick={runVerify} disabled={verifying} style={{
            background: GOLD, color: "#000", border: "none", borderRadius: 6,
            padding: "8px 16px", fontWeight: 700, cursor: verifying ? "wait" : "pointer", fontSize: 13,
            opacity: verifying ? 0.7 : 1,
          }}>
            {verifying ? "Verifying..." : "Run Verification"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 28 }}>{health?.db_connected ? "🟢" : "🔴"}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: statusColor }}>{statusLabel}</div>
            <div style={{ fontSize: 12, color: MUTED }}>
              {health?.timestamp ? `Last check: ${new Date(health.timestamp).toLocaleString()}` : "Never checked"}
            </div>
          </div>
        </div>

        {/* Table Counts */}
        {health?.table_counts && (
          <div>
            <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Table Row Counts</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {Object.entries(health.table_counts).map(([table, count]) => (
                <div key={table} style={{ background: "#1a1a3a", borderRadius: 6, padding: 12 }}>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>{table}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: count >= 0 ? TEXT : "#e04050" }}>
                    {count >= 0 ? count.toLocaleString() : "Error"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Last Verification */}
      {health?.last_verification && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20 }}>
          <h3 style={{ color: GOLD, margin: "0 0 12px" }}>📋 Last Verification</h3>
          <div style={{ fontSize: 13, color: TEXT, marginBottom: 8 }}>
            <strong>Status:</strong>{" "}
            <span style={{ color: health.last_verification.status === "ok" ? GREEN : GOLD }}>
              {health.last_verification.status?.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            {health.last_verification.verified_at
              ? new Date(health.last_verification.verified_at).toLocaleString()
              : health.last_verification.timestamp
              ? new Date(health.last_verification.timestamp).toLocaleString()
              : "—"}
          </div>
          {health.last_verification.notes && (
            <div style={{ fontSize: 12, color: TEXT, background: "#1a1a3a", borderRadius: 6, padding: 10, whiteSpace: "pre-wrap" }}>
              {health.last_verification.notes}
            </div>
          )}
        </div>
      )}

      {health?.errors?.length > 0 && (
        <div style={{ background: "#331111", border: "1px solid #553333", borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h4 style={{ color: "#e04050", margin: "0 0 8px" }}>Errors</h4>
          {health.errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#e08080", marginBottom: 4 }}>{e.table}: {e.error}</div>
          ))}
        </div>
      )}
    </div>
  );
}

