"use client";
import { useState, useEffect, useCallback } from "react";

const TYPE_COLORS = {
  deadline: "#e74c3c",
  hearing: "#ebb003",
  deposition: "#3498db",
  sol: "#c0392b",
  meeting: "#386f4a",
  other: "#888",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const res = await fetch(`/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      setSyncResult(data);
      fetchEvents();
    } catch (err) {
      setSyncResult({ error: err.message });
    }
    setSyncing(false);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const getEventsForDay = (day) => {
    return events.filter((e) => {
      const d = new Date(e.start?.dateTime || e.start);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const upcomingEvents = events
    .filter((e) => {
      const d = new Date(e.start?.dateTime || e.start);
      const now = new Date();
      const twoWeeks = new Date(now);
      twoWeeks.setDate(twoWeeks.getDate() + 14);
      return d >= now && d <= twoWeeks;
    })
    .sort((a, b) => new Date(a.start?.dateTime || a.start) - new Date(b.start?.dateTime || b.start))
    .slice(0, 20);

  const guessType = (subject) => {
    const s = (subject || "").toLowerCase();
    if (s.includes("deadline")) return "deadline";
    if (s.includes("hearing")) return "hearing";
    if (s.includes("deposition")) return "deposition";
    if (s.includes("sol")) return "sol";
    if (s.includes("mediation") || s.includes("meeting")) return "meeting";
    return "other";
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ display: "flex", gap: 24, padding: 24, minHeight: "100vh", background: "#000033", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={prevMonth} style={navBtn}>◀</button>
            <h2 style={{ margin: 0, fontSize: 22, color: "#ebb003" }}>{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} style={navBtn}>▶</button>
            <button onClick={goToday} style={{ ...navBtn, fontSize: 13, padding: "6px 14px" }}>Today</button>
          </div>
          <button onClick={handleSync} disabled={syncing} style={{ background: "#386f4a", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: syncing ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
            {syncing ? "Syncing..." : "⟳ Sync Calendar"}
          </button>
        </div>

        {syncResult && (
          <div style={{ background: syncResult.error ? "#5a1a1a" : "#1a3a2a", padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            {syncResult.error ? `Error: ${syncResult.error}` : `Synced: ${syncResult.stats?.inserted} new, ${syncResult.stats?.updated} updated, ${syncResult.stats?.matched} matched to cases`}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "#111155" }}>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: 8, textAlign: "center", fontWeight: 600, fontSize: 13, color: "#ebb003", background: "#000044" }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            return (
              <div key={i} style={{ minHeight: 90, padding: 4, background: isToday ? "#000066" : "#000044", borderRadius: 2, position: "relative" }}>
                {day && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? "#ebb003" : "#aaa", marginBottom: 2 }}>{day}</div>
                    {dayEvents.slice(0, 3).map((e, j) => {
                      const type = guessType(e.subject);
                      return (
                        <div key={j} onClick={() => setSelectedEvent(e)} style={{ background: TYPE_COLORS[type] + "33", borderLeft: `3px solid ${TYPE_COLORS[type]}`, padding: "2px 4px", marginBottom: 2, fontSize: 10, borderRadius: 2, cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "#eee" }}>
                          {e.subject}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div style={{ fontSize: 10, color: "#888" }}>+{dayEvents.length - 3} more</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {selectedEvent && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setSelectedEvent(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#000055", borderRadius: 12, padding: 24, maxWidth: 480, width: "90%", border: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <h3 style={{ margin: 0, color: "#ebb003", fontSize: 18 }}>{selectedEvent.subject}</h3>
                <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ marginTop: 12, fontSize: 14, color: "#ccc" }}>
                <p><strong>Start:</strong> {new Date(selectedEvent.start?.dateTime || selectedEvent.start).toLocaleString()}</p>
                <p><strong>End:</strong> {new Date(selectedEvent.end?.dateTime || selectedEvent.end).toLocaleString()}</p>
                {selectedEvent.location && <p><strong>Location:</strong> {selectedEvent.location}</p>}
                {selectedEvent.bodyPreview && <p style={{ color: "#aaa" }}>{selectedEvent.bodyPreview}</p>}
                {selectedEvent.caseName && <p><strong>Matched Case:</strong> {selectedEvent.caseName}</p>}
                <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: TYPE_COLORS[guessType(selectedEvent.subject)] + "44", color: TYPE_COLORS[guessType(selectedEvent.subject)] }}>
                  {guessType(selectedEvent.subject).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 280, flexShrink: 0 }}>
        <h3 style={{ color: "#ebb003", marginTop: 0, fontSize: 16 }}>Upcoming (14 days)</h3>
        {loading ? <p style={{ color: "#888" }}>Loading...</p> : upcomingEvents.length === 0 ? <p style={{ color: "#888", fontSize: 13 }}>No upcoming events</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.map((e, i) => {
              const type = guessType(e.subject);
              const d = new Date(e.start?.dateTime || e.start);
              return (
                <div key={i} onClick={() => setSelectedEvent(e)} style={{ background: "#000055", borderRadius: 8, padding: 10, cursor: "pointer", borderLeft: `3px solid ${TYPE_COLORS[type]}` }}>
                  <div style={{ fontSize: 11, color: "#888" }}>{d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div style={{ fontSize: 13, color: "#eee", marginTop: 2 }}>{e.subject}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const navBtn = { background: "#000066", border: "1px solid #333", color: "#ebb003", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 16 };
