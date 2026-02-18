'use client';
import { useState, useEffect, useCallback } from 'react';

const B = { navy: "#000066", gold: "#ebb003", green: "#386f4a", bg: "#08080f", card: "#111119", bdr: "#1e1e2e", txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a", danger: "#e04050", purple: "#8b5cf6" };

const typeConfig = {
  note: { icon: "📝", color: "#8888a0", label: "Note" },
  status_change: { icon: "🔄", color: "#ebb003", label: "Status Change" },
  edit: { icon: "✏️", color: "#8888a0", label: "Edit" },
  task: { icon: "✅", color: "#386f4a", label: "Task" },
  negotiation: { icon: "💰", color: "#5b8def", label: "Negotiation" },
  estimate: { icon: "📊", color: "#e09040", label: "Estimate" },
  pleading: { icon: "⚖️", color: "#8b5cf6", label: "Pleading" },
  email: { icon: "✉️", color: "#2563eb", label: "Email" },
  call: { icon: "📞", color: "#386f4a", label: "Call" },
  document: { icon: "📄", color: "#8888a0", label: "Document" },
  milestone: { icon: "🏁", color: "#ebb003", label: "Milestone" },
  deadline: { icon: "⏰", color: "#e04050", label: "Deadline" },
};

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtFullDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function ComprehensiveActivityFeed({ caseId, compact = false, limit: maxItems }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCount, setShowCount] = useState(maxItems || 50);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/timeline`);
      const data = await res.json();
      setEvents(data.timeline || []);
    } catch (err) {
      console.error("Failed to fetch timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);
  const displayed = filtered.slice(0, showCount);

  // Count by type for filter badges
  const typeCounts = {};
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }

  const filterTypes = ["all", ...Object.keys(typeCounts).sort()];

  if (loading) {
    return (
      <div style={{ padding: compact ? 16 : 24, textAlign: "center", color: B.gold, fontSize: 13 }}>
        Loading activity feed...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {!compact && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.txt }}>
            📋 Activity Feed <span style={{ fontSize: 12, fontWeight: 400, color: B.txtM }}>({events.length} events)</span>
          </h3>
          <button onClick={fetchTimeline} style={{ background: "none", border: `1px solid ${B.bdr}`, color: B.txtM, padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
            🔄 Refresh
          </button>
        </div>
      )}

      {/* Filter pills */}
      {!compact && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {filterTypes.map(t => {
            const cfg = typeConfig[t] || { label: t, color: "#888" };
            const isActive = filter === t;
            const count = t === "all" ? events.length : typeCounts[t] || 0;
            return (
              <button key={t} onClick={() => setFilter(t)} style={{
                padding: "4px 12px", borderRadius: 20, border: `1px solid ${isActive ? (cfg.color || B.gold) : B.bdr}`,
                background: isActive ? `${cfg.color || B.gold}20` : "transparent",
                color: isActive ? (cfg.color || B.gold) : B.txtM,
                fontSize: 11, fontWeight: isActive ? 600 : 400, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {t === "all" ? "All" : (cfg.icon || "") + " " + (cfg.label || t)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {displayed.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: B.txtD, fontSize: 13 }}>
          No activity found{filter !== "all" ? ` for "${filter}"` : ""}.
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: compact ? 0 : 24 }}>
          {/* Timeline line */}
          {!compact && <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 2, background: B.bdr }} />}

          {displayed.map((evt, i) => {
            const cfg = typeConfig[evt.type] || { icon: "•", color: "#888", label: evt.type };
            return (
              <div key={evt.id || i} style={{
                display: "flex", gap: compact ? 8 : 12, padding: compact ? "6px 0" : "8px 0",
                borderBottom: `1px solid ${B.bdr}08`,
              }}>
                {/* Timeline dot */}
                {!compact && (
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: `${cfg.color}30`, border: `2px solid ${cfg.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, marginLeft: -10, zIndex: 1,
                  }}>
                    {cfg.icon}
                  </div>
                )}
                {compact && <span style={{ fontSize: 12, flexShrink: 0 }}>{cfg.icon}</span>}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
                      color: cfg.color, padding: "1px 6px", borderRadius: 4,
                      background: `${cfg.color}15`,
                    }}>
                      {cfg.label}
                    </span>
                    {evt.actor && (
                      <span style={{ fontSize: 11, color: B.txtM, fontWeight: 500 }}>{evt.actor}</span>
                    )}
                    <span style={{ fontSize: 10, color: B.txtD, fontFamily: "'JetBrains Mono', monospace", marginLeft: "auto", flexShrink: 0 }}
                      title={fmtFullDate(evt.date)}>
                      {fmtDate(evt.date)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: B.txt, marginTop: 2, lineHeight: 1.4 }}>
                    {evt.description}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length > showCount && (
            <button onClick={() => setShowCount(s => s + 50)} style={{
              display: "block", width: "100%", padding: "10px", marginTop: 8,
              background: "none", border: `1px solid ${B.bdr}`, borderRadius: 8,
              color: B.gold, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
              Show more ({filtered.length - showCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
