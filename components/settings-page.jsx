"use client";
import { useState, useEffect } from "react";
import TeamInvitePanel from "./team-invite-panel";

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

  const tabs = ["Team", "Statuses", "Firm Info", "Data Stats", "Import/Export"];

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, padding: 24 }}>
      <h1 style={{ color: GOLD, marginBottom: 4 }}>⚙️ Settings</h1>
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

      {/* Case Statuses */}
      {tab === 1 && (
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
      {tab === 2 && (
        <div style={cardStyle}>
          <h3 style={{ color: GOLD, marginTop: 0 }}>🏛️ Firm Information</h3>
          <div style={{ lineHeight: 2 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: GOLD, marginBottom: 8 }}>Denham Property and Injury Law Firm</div>
            <div>📍 250 W. Main St. Suite 120, Lexington, KY 40507</div>
            <div>📞 859-900-2278</div>
            <div>🌐 <a href="https://www.denim.law" style={{ color: GOLD }} target="_blank" rel="noreferrer">www.denim.law</a></div>
          </div>
        </div>
      )}

      {/* Data Stats */}
      {tab === 3 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Total Cases", value: data?.case_count ?? "—", color: GOLD },
              { label: "Total Documents", value: data?.document_count ?? "—", color: GREEN },
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
            Last fetched: {data?.fetched_at ? new Date(data.fetched_at).toLocaleString() : "—"}
          </div>
        </div>
      )}

      {/* Import/Export */}
      {tab === 4 && (
        <div style={cardStyle}>
          <h3 style={{ color: GOLD, marginTop: 0 }}>📦 Export Data</h3>
          <p style={{ color: MUTED }}>Download all case data in your preferred format.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={btnStyle} onClick={() => exportData("csv")}>⬇ Export CSV</button>
            <button style={{ ...btnStyle, background: GREEN, color: "#fff" }} onClick={() => exportData("json")}>⬇ Export JSON</button>
          </div>
        </div>
      )}
    </div>
  );
}

