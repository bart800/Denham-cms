"use client";
import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";

const ACTION_COLORS = {
  create: "#2ecc71",
  update: "#4a90d9",
  delete: "#e74c3c",
  view: "#9b59b6",
  export: "#e67e22",
  status_change: GOLD,
  login: GREEN,
};

const ACTION_ICONS = {
  create: "➕",
  update: "✏️",
  delete: "🗑️",
  view: "👁️",
  export: "📤",
  status_change: "🔄",
  login: "🔑",
};

const USER_TYPE_COLORS = {
  staff: "#4a90d9",
  client: GREEN,
  system: "#9b59b6",
};

const ENTITY_TYPES = ["case", "contact", "document", "task", "negotiation", "estimate", "pleading", "expense", "lien", "user", "setting"];
const ACTION_TYPES = ["create", "update", "delete", "view", "export", "status_change", "login"];
const USER_TYPES = ["staff", "client", "system"];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatChanges(changes) {
  if (!changes || typeof changes !== "object") return null;
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;
  return entries;
}

function toCSV(entries) {
  const headers = ["Timestamp", "User Type", "User ID", "Action", "Entity Type", "Entity ID", "Changes"];
  const rows = entries.map((e) => [
    e.created_at,
    e.user_type || "",
    e.user_id || "",
    e.action || "",
    e.entity_type || "",
    e.entity_id || "",
    JSON.stringify(e.changes || {}).replace(/"/g, '""'),
  ]);
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function downloadCSV(entries) {
  const blob = new Blob([toCSV(entries)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
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
  typeBadge: {
    display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, marginLeft: 8,
  },
  userTypeBadge: {
    display: "inline-block", padding: "2px 6px", borderRadius: 8, fontSize: 10, fontWeight: 600, marginLeft: 6,
  },
  loadMore: {
    display: "block", width: "100%", padding: "10px 0", textAlign: "center", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: GOLD, fontSize: 14,
    fontWeight: 600, cursor: "pointer", marginTop: 8,
  },
  empty: { textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 15 },
  total: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  changesBox: {
    marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)", fontSize: 12,
  },
};

export default function AuditLog({ onNavigateCase }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    user_id: "", user_type: "", action: "", entity_type: "", entity_id: "",
    start_date: "", end_date: "", search: "",
  });
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [source, setSource] = useState("audit"); // "audit" or "activity"
  const LIMIT = 50;

  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true);
    const o = reset ? 0 : offset;
    const params = new URLSearchParams();
    params.set("limit", LIMIT);
    params.set("offset", o);

    if (source === "audit") {
      if (filters.user_id) params.set("user_id", filters.user_id);
      if (filters.user_type) params.set("user_type", filters.user_type);
      if (filters.action) params.set("action", filters.action);
      if (filters.entity_type) params.set("entity_type", filters.entity_type);
      if (filters.entity_id) params.set("entity_id", filters.entity_id);
      if (filters.start_date) params.set("start_date", filters.start_date);
      if (filters.end_date) params.set("end_date", filters.end_date);
    } else {
      if (filters.user_id) params.set("user_id", filters.user_id);
      if (filters.action) params.set("type", filters.action);
      if (filters.start_date) params.set("from", filters.start_date);
      if (filters.end_date) params.set("to", filters.end_date);
    }

    try {
      const endpoint = source === "audit" ? "/api/audit" : "/api/activity";
      const res = await fetch(`${endpoint}?${params}`);
      const json = await res.json();
      const newData = json.data || [];
      if (reset) {
        setEntries(newData);
        setOffset(LIMIT);
      } else {
        setEntries((prev) => [...prev, ...newData]);
        setOffset(o + LIMIT);
      }
      setTotal(json.count || json.total || 0);
    } catch (err) {
      console.error("Failed to fetch audit log:", err);
    } finally {
      setLoading(false);
    }
  }, [offset, filters, source]);

  useEffect(() => { fetchEntries(true); }, [filters, source]);

  const updateFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setOffset(0);
  };

  const filteredEntries = entries.filter(e => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    const text = [e.action, e.entity_type, e.entity_id, e.user_id, e.user_type, JSON.stringify(e.changes || {}),
      e.description, e.team_members?.name].filter(Boolean).join(" ").toLowerCase();
    return text.includes(q);
  });

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>📋 Audit Trail</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={s.total}>{total} entries</span>
          <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.04)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            {[["audit", "Audit Trail"], ["activity", "Activity Log"]].map(([key, label]) => (
              <button key={key} onClick={() => setSource(key)} style={{
                padding: "5px 12px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                background: source === key ? GOLD : "transparent",
                color: source === key ? "#000" : "rgba(255,255,255,0.5)",
              }}>{label}</button>
            ))}
          </div>
          <button style={s.btnOutline} onClick={() => downloadCSV(filteredEntries)}>⬇ Export CSV</button>
        </div>
      </div>

      <div style={s.filtersBar}>
        <input style={{ ...s.input, minWidth: 200 }} placeholder="🔍 Search all fields..." value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} />
        <input style={s.input} type="date" value={filters.start_date} onChange={(e) => updateFilter("start_date", e.target.value)} title="From date" />
        <input style={s.input} type="date" value={filters.end_date} onChange={(e) => updateFilter("end_date", e.target.value)} title="To date" />
        {source === "audit" && (
          <select style={s.select} value={filters.user_type} onChange={(e) => updateFilter("user_type", e.target.value)}>
            <option value="">All User Types</option>
            {USER_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        )}
        <select style={s.select} value={filters.action} onChange={(e) => updateFilter("action", e.target.value)}>
          <option value="">All Actions</option>
          {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
        {source === "audit" && (
          <select style={s.select} value={filters.entity_type} onChange={(e) => updateFilter("entity_type", e.target.value)}>
            <option value="">All Entities</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        )}
        <input style={s.input} placeholder="User ID" value={filters.user_id} onChange={(e) => updateFilter("user_id", e.target.value)} />
        {source === "audit" && (
          <input style={s.input} placeholder="Entity ID" value={filters.entity_id} onChange={(e) => updateFilter("entity_id", e.target.value)} />
        )}
        <button style={s.btn} onClick={() => setFilters({ user_id: "", user_type: "", action: "", entity_type: "", entity_id: "", start_date: "", end_date: "", search: "" })}>Clear</button>
      </div>

      {filteredEntries.length === 0 && !loading && <div style={s.empty}>No audit entries found</div>}

      {filteredEntries.map((entry, i) => {
        const isAudit = source === "audit";
        const action = isAudit ? entry.action : entry.type;
        const actionColor = ACTION_COLORS[action] || "rgba(255,255,255,0.3)";
        const icon = ACTION_ICONS[action] || "📌";
        const userTypeColor = USER_TYPE_COLORS[entry.user_type] || "rgba(255,255,255,0.3)";
        const changes = isAudit ? formatChanges(entry.changes) : null;
        const isExpanded = expandedId === (entry.id || i);
        const userName = isAudit ? (entry.user_id || "System") : (entry.team_members?.name || "Unknown");

        return (
          <div key={entry.id || i} style={{ ...s.entry, cursor: changes ? "pointer" : "default" }}
            onClick={() => changes && setExpandedId(isExpanded ? null : (entry.id || i))}>
            <div style={{ ...s.avatar, background: actionColor }}>{icon}</div>
            <div style={s.entryBody}>
              <div style={s.entryTop}>
                <div>
                  <span style={s.userName}>{userName}</span>
                  {isAudit && entry.user_type && (
                    <span style={{ ...s.userTypeBadge, background: userTypeColor + "22", color: userTypeColor }}>
                      {entry.user_type}
                    </span>
                  )}
                  <span style={{ ...s.typeBadge, background: actionColor + "22", color: actionColor }}>
                    {(action || "action").replace("_", " ")}
                  </span>
                </div>
                <span style={s.timestamp}>{formatDate(entry.created_at)}</span>
              </div>
              <div style={s.description}>
                {isAudit ? (
                  <>
                    {entry.entity_type && <span style={{ color: GOLD }}>{entry.entity_type}</span>}
                    {entry.entity_id && <span style={{ opacity: 0.6 }}> #{entry.entity_id}</span>}
                  </>
                ) : (
                  entry.description || "No description"
                )}
              </div>
              {isAudit && entry.entity_type === "case" && entry.entity_id && (
                <span style={{ fontSize: 12, color: GOLD, cursor: "pointer", textDecoration: "underline", marginTop: 4, display: "inline-block" }}
                  onClick={(e) => { e.stopPropagation(); onNavigateCase && onNavigateCase(entry.entity_id); }}>
                  View Case →
                </span>
              )}
              {!isAudit && entry.cases && (
                <span style={{ fontSize: 12, color: GOLD, cursor: "pointer", textDecoration: "underline", marginTop: 4, display: "inline-block" }}
                  onClick={(e) => { e.stopPropagation(); onNavigateCase && onNavigateCase(entry.cases.id); }}>
                  {entry.cases.client_name} — {entry.cases.ref}
                </span>
              )}
              {isExpanded && changes && (
                <div style={s.changesBox}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Changes</div>
                  {changes.map(([key, val]) => (
                    <div key={key} style={{ padding: "2px 0", display: "flex", gap: 8 }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", minWidth: 100 }}>{key}:</span>
                      <span style={{ color: "#e0e0e0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {filteredEntries.length < total && (
        <button style={s.loadMore} onClick={() => fetchEntries(false)} disabled={loading}>
          {loading ? "Loading..." : `Load More (${filteredEntries.length}/${total})`}
        </button>
      )}
    </div>
  );
}
