"use client";
import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";

const TYPE_COLORS = {
  edit: "#4a90d9",
  status_change: GOLD,
  note: "#9b59b6",
  task: GREEN,
  created: "#2ecc71",
  deleted: "#e74c3c",
  comment: "#1abc9c",
  upload: "#e67e22",
};

const TYPE_ICONS = {
  edit: "✏️",
  status_change: "🔄",
  note: "📝",
  task: "✅",
  created: "➕",
  deleted: "🗑️",
  comment: "💬",
  upload: "📎",
};

const ACTION_TYPES = ["edit", "status_change", "note", "task", "created", "deleted", "comment", "upload"];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toCSV(entries) {
  const headers = ["Timestamp", "User", "Type", "Description", "Case", "Ref"];
  const rows = entries.map((e) => [
    e.created_at,
    e.team_members?.name || "Unknown",
    e.type || "",
    (e.description || "").replace(/"/g, '""'),
    e.cases?.client_name || "",
    e.cases?.ref || "",
  ]);
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function downloadCSV(entries) {
  const blob = new Blob([toCSV(entries)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const s = {
  container: { width: "100%", fontFamily: "'Inter', sans-serif", color: "#e0e0e0" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, color: GOLD, margin: 0 },
  filtersBar: {
    display: "flex", flexWrap: "wrap", gap: 10, padding: 14, borderRadius: 10,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, alignItems: "center",
  },
  input: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#e0e0e0", padding: "7px 10px", fontSize: 13, outline: "none", minWidth: 120,
  },
  select: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#e0e0e0", padding: "7px 10px", fontSize: 13, outline: "none", minWidth: 130,
  },
  btn: {
    background: GOLD, color: "#000", border: "none", borderRadius: 6, padding: "7px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  btnOutline: {
    background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 6,
    padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  entry: {
    display: "flex", gap: 12, padding: "12px 14px", borderRadius: 8, marginBottom: 6,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    alignItems: "flex-start", transition: "background 0.15s",
  },
  avatar: {
    width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0, color: "#fff",
  },
  entryBody: { flex: 1, minWidth: 0 },
  entryTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  userName: { fontWeight: 600, fontSize: 14, color: "#fff" },
  timestamp: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  description: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  caseLink: {
    fontSize: 12, color: GOLD, cursor: "pointer", textDecoration: "underline", marginTop: 4, display: "inline-block",
  },
  typeBadge: {
    display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, marginLeft: 8,
  },
  loadMore: {
    display: "block", width: "100%", padding: "10px 0", textAlign: "center", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: GOLD, fontSize: 14,
    fontWeight: 600, cursor: "pointer", marginTop: 8,
  },
  empty: { textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 15 },
  total: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
};

export default function AuditLog({ onNavigateCase }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ case_id: "", user_id: "", type: "", from: "", to: "" });
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true);
    const o = reset ? 0 : offset;
    const params = new URLSearchParams();
    params.set("limit", LIMIT);
    params.set("offset", o);
    if (filters.case_id) params.set("case_id", filters.case_id);
    if (filters.user_id) params.set("user_id", filters.user_id);
    if (filters.type) params.set("type", filters.type);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    try {
      const res = await fetch(`/api/activity?${params}`);
      const json = await res.json();
      if (reset) {
        setEntries(json.data || []);
        setOffset(LIMIT);
      } else {
        setEntries((prev) => [...prev, ...(json.data || [])]);
        setOffset(o + LIMIT);
      }
      setTotal(json.total || 0);
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setLoading(false);
    }
  }, [offset, filters]);

  useEffect(() => { fetchEntries(true); }, [filters]);

  const updateFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setOffset(0);
  };

  const initials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>📋 Audit Log</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={s.total}>{total} entries</span>
          <button style={s.btnOutline} onClick={() => downloadCSV(entries)}>⬇ Export CSV</button>
        </div>
      </div>

      <div style={s.filtersBar}>
        <input style={s.input} type="date" placeholder="From" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} />
        <input style={s.input} type="date" placeholder="To" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} />
        <input style={s.input} placeholder="Case ID" value={filters.case_id} onChange={(e) => updateFilter("case_id", e.target.value)} />
        <input style={s.input} placeholder="User ID" value={filters.user_id} onChange={(e) => updateFilter("user_id", e.target.value)} />
        <select style={s.select} value={filters.type} onChange={(e) => updateFilter("type", e.target.value)}>
          <option value="">All Types</option>
          {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
        <button style={s.btn} onClick={() => setFilters({ case_id: "", user_id: "", type: "", from: "", to: "" })}>Clear</button>
      </div>

      {entries.length === 0 && !loading && <div style={s.empty}>No activity entries found</div>}

      {entries.map((entry, i) => {
        const typeColor = TYPE_COLORS[entry.type] || "rgba(255,255,255,0.3)";
        const icon = TYPE_ICONS[entry.type] || "📌";
        return (
          <div key={entry.id || i} style={s.entry}>
            <div style={{ ...s.avatar, background: typeColor }}>{initials(entry.team_members?.name)}</div>
            <div style={s.entryBody}>
              <div style={s.entryTop}>
                <div>
                  <span style={s.userName}>{entry.team_members?.name || "Unknown"}</span>
                  <span style={{ ...s.typeBadge, background: typeColor + "22", color: typeColor }}>
                    {icon} {(entry.type || "action").replace("_", " ")}
                  </span>
                </div>
                <span style={s.timestamp}>{formatDate(entry.created_at)}</span>
              </div>
              <div style={s.description}>{entry.description || "No description"}</div>
              {entry.cases && (
                <span style={s.caseLink} onClick={() => onNavigateCase && onNavigateCase(entry.cases.id)}>
                  {entry.cases.client_name} — {entry.cases.ref}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {entries.length < total && (
        <button style={s.loadMore} onClick={() => fetchEntries(false)} disabled={loading}>
          {loading ? "Loading..." : `Load More (${entries.length}/${total})`}
        </button>
      )}
    </div>
  );
}
