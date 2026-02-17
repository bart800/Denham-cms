"use client";
import { useState, useEffect } from "react";

const COLORS = {
  note: "#4a90d9",
  status_change: "#ebb003",
  negotiation: "#386f4a",
  milestone: "#000066",
  document: "#888",
};

const ICONS = {
  note: "📝",
  status_change: "🔄",
  negotiation: "💰",
  milestone: "🏛️",
  document: "📄",
};

const LABELS = {
  note: "Note",
  status_change: "Status Change",
  negotiation: "Negotiation",
  milestone: "Milestone",
  document: "Document",
};

const FILTER_TYPES = ["all", "note", "status_change", "negotiation", "milestone", "document"];

export default function CaseTimeline({ caseId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/cases/${caseId}/timeline`)
      .then((r) => r.json())
      .then((d) => setEvents(d.timeline || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, color: "#e0e0e0" }}>
      <h3 style={{ margin: "0 0 16px", color: "#fff", fontSize: 18, fontWeight: 600 }}>
        📅 Case Timeline
      </h3>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              background: filter === t ? (t === "all" ? "#000066" : COLORS[t]) : "#2a2a3e",
              color: filter === t ? "#fff" : "#aaa",
              transition: "all 0.2s",
            }}
          >
            {t === "all" ? "All" : `${ICONS[t]} ${LABELS[t]}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#888", textAlign: "center", padding: 40 }}>Loading timeline…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#888", textAlign: "center", padding: 40 }}>No activity found.</p>
      ) : (
        <div style={{ position: "relative", paddingLeft: 28 }}>
          {/* Vertical line */}
          <div
            style={{
              position: "absolute",
              left: 9,
              top: 6,
              bottom: 6,
              width: 2,
              background: "#333",
              borderRadius: 1,
            }}
          />

          {filtered.map((event, i) => {
            const color = COLORS[event.type] || "#888";
            return (
              <div key={event.id || i} style={{ position: "relative", marginBottom: 24 }}>
                {/* Dot */}
                <div
                  style={{
                    position: "absolute",
                    left: -24,
                    top: 4,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: color,
                    border: "2px solid #1a1a2e",
                    boxShadow: `0 0 6px ${color}66`,
                    zIndex: 1,
                  }}
                />

                {/* Content */}
                <div
                  style={{
                    background: "#22223a",
                    borderRadius: 8,
                    padding: "12px 16px",
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#aaa" }}>{formatDate(event.date)}</span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: `${color}33`,
                        color: color,
                        fontWeight: 600,
                      }}
                    >
                      {ICONS[event.type]} {LABELS[event.type] || event.type}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#e0e0e0", lineHeight: 1.4 }}>
                    {event.description}
                  </p>
                  {event.actor && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#777" }}>— {event.actor}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
