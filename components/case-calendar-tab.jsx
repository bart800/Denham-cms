"use client";
import { useState, useEffect } from "react";

const TYPE_COLORS = {
  deadline: "#e74c3c",
  hearing: "#ebb003",
  deposition: "#3498db",
  sol: "#c0392b",
  meeting: "#386f4a",
  other: "#888",
};

export default function CaseCalendarTab({ caseId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/cases/${caseId}/calendar`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <div style={{ padding: 20, color: "#888" }}>Loading calendar events...</div>;
  if (events.length === 0) return <div style={{ padding: 20, color: "#888" }}>No calendar events linked to this case. Run a calendar sync to match events.</div>;

  const now = new Date();

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ color: "#ebb003", margin: "0 0 16px 0", fontSize: 16 }}>Calendar Events</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {events.map((e) => {
          const start = new Date(e.start_time);
          const isPast = start < now;
          const type = e.event_type || "other";
          return (
            <div key={e.id} style={{ display: "flex", gap: 12, padding: 12, background: "#000055", borderRadius: 8, borderLeft: `4px solid ${TYPE_COLORS[type] || "#888"}`, opacity: isPast ? 0.6 : 1 }}>
              <div style={{ minWidth: 60, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>{start.toLocaleDateString(undefined, { month: "short" })}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{start.getDate()}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{start.toLocaleDateString(undefined, { weekday: "short" })}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#eee" }}>{e.subject}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600, background: (TYPE_COLORS[type] || "#888") + "33", color: TYPE_COLORS[type] || "#888" }}>
                    {type.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa" }}>
                  {e.is_all_day ? "All day" : `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(e.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </div>
                {e.location && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>📍 {e.location}</div>}
                {e.body_preview && <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{e.body_preview}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
