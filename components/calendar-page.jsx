"use client";
import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const RED = "#e53935";
const CARD_BG = "#0a0a2e";
const TEXT = "#e0e0e0";
const TEXT_DIM = "#888";

const TYPE_COLORS = {
  deadline: "#e74c3c",
  hearing: "#ebb003",
  deposition: "#3498db",
  sol: "#c0392b",
  meeting: "#386f4a",
  other: "#666",
};

const TYPE_ICONS = {
  deadline: "⚠️",
  hearing: "⚖️",
  deposition: "📋",
  sol: "🔴",
  meeting: "🤝",
  other: "📅",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","December"];

function guessType(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("deadline")) return "deadline";
  if (s.includes("hearing")) return "hearing";
  if (s.includes("deposition") || s.includes("depo")) return "deposition";
  if (s.includes("sol") || s.includes("statute")) return "sol";
  if (s.includes("mediation") || s.includes("meeting")) return "meeting";
  return "other";
}

function countdownText(days) {
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  if (days < 0) return `${Math.abs(days)}d OVERDUE`;
  return `${days}d`;
}

function urgencyColor(days) {
  if (days <= 0) return RED;
  if (days <= 3) return "#e74c3c";
  if (days <= 7) return "#ff9800";
  if (days <= 14) return GOLD;
  return GREEN;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [view, setView] = useState("month"); // month or deadlines

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const res = await fetch(`/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    }
    setLoading(false);
  }, [year, month]);

  const fetchDeadlines = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/deadlines");
      if (res.ok) setDeadlines(await res.json());
    } catch (err) {
      console.error("Failed to fetch deadlines:", err);
    }
  }, []);

  useEffect(() => { fetchEvents(); fetchDeadlines(); }, [fetchEvents, fetchDeadlines]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      setSyncResult(data);
      fetchEvents();
      fetchDeadlines();
    } catch (err) {
      setSyncResult({ error: err.message });
    }
    setSyncing(false);
  };

  const toggleMet = async (deadline) => {
    const newVal = !deadline.is_met;
    try {
      await fetch(`/api/calendar/${deadline.id}/met`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_met: newVal }),
      });
      setDeadlines(prev => prev.map(d => d.id === deadline.id ? { ...d, is_met: newVal, met_at: newVal ? new Date().toISOString() : null } : d));
    } catch (err) {
      console.error("Failed to toggle met:", err);
    }
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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const criticalDeadlines = deadlines.filter(d => !d.is_met && d.days_remaining <= 14);
  const upcomingDeadlines = deadlines.filter(d => !d.is_met && d.days_remaining > 14);
  const metDeadlines = deadlines.filter(d => d.is_met);

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: NAVY, color: TEXT, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, color: GOLD }}>📅 Calendar</h1>
          <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
            {[{ id: "month", label: "Calendar" }, { id: "deadlines", label: "Deadlines" }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                background: view === v.id ? GOLD : "transparent", color: view === v.id ? "#000" : TEXT_DIM,
                border: `1px solid ${view === v.id ? GOLD : "#333"}`, borderRadius: 6, padding: "6px 14px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{v.label}</button>
            ))}
          </div>
        </div>
        <button onClick={handleSync} disabled={syncing} style={{
          background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px",
          cursor: syncing ? "wait" : "pointer", fontSize: 14, fontWeight: 600, opacity: syncing ? 0.6 : 1,
        }}>
          {syncing ? "Syncing..." : "⟳ Sync Calendar"}
        </button>
      </div>

      {syncResult && (
        <div style={{ background: syncResult.error ? "#5a1a1a" : "#1a3a2a", padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          {syncResult.error ? `Error: ${syncResult.error}` : `Synced: ${syncResult.stats?.inserted} new, ${syncResult.stats?.updated} updated, ${syncResult.stats?.matched} matched to cases`}
        </div>
      )}

      {view === "month" && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* Calendar grid */}
          <div style={{ flex: "1 1 600px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button onClick={prevMonth} style={navBtn}>◀</button>
              <h2 style={{ margin: 0, fontSize: 20, color: GOLD, minWidth: 200, textAlign: "center" }}>{MONTHS[month]} {year}</h2>
              <button onClick={nextMonth} style={navBtn}>▶</button>
              <button onClick={goToday} style={{ ...navBtn, fontSize: 13, padding: "6px 14px" }}>Today</button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: TEXT_DIM }}>Loading...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "#111155", borderRadius: 8, overflow: "hidden" }}>
                {DAYS.map((d) => (
                  <div key={d} style={{ padding: 8, textAlign: "center", fontWeight: 600, fontSize: 12, color: GOLD, background: "#000044" }}>{d}</div>
                ))}
                {cells.map((day, i) => {
                  const dayEvents = day ? getEventsForDay(day) : [];
                  const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                  return (
                    <div key={i} style={{
                      minHeight: 100, padding: 4, background: isToday ? "#000066" : "#000044",
                      borderRadius: 0, position: "relative",
                      border: isToday ? `2px solid ${GOLD}` : "none",
                    }}>
                      {day && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? GOLD : "#aaa", marginBottom: 2 }}>{day}</div>
                          {dayEvents.slice(0, 4).map((e, j) => {
                            const type = guessType(e.subject);
                            return (
                              <div key={j} onClick={() => setSelectedEvent(e)} style={{
                                background: TYPE_COLORS[type] + "33",
                                borderLeft: `3px solid ${TYPE_COLORS[type]}`,
                                padding: "2px 4px", marginBottom: 1, fontSize: 10, borderRadius: 2,
                                cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap",
                                textOverflow: "ellipsis", color: "#eee",
                              }}>
                                {e.subject}
                              </div>
                            );
                          })}
                          {dayEvents.length > 4 && <div style={{ fontSize: 10, color: TEXT_DIM }}>+{dayEvents.length - 4} more</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deadline sidebar */}
          <div style={{ width: 320, flexShrink: 0 }}>
            <h3 style={{ color: RED, margin: "0 0 12px", fontSize: 16 }}>🔥 Upcoming Deadlines</h3>
            {criticalDeadlines.length === 0 && <p style={{ color: TEXT_DIM, fontSize: 13 }}>No critical deadlines</p>}
            {criticalDeadlines.map((d) => (
              <DeadlineCard key={d.id} deadline={d} onToggleMet={toggleMet} onClick={() => setSelectedEvent(d)} />
            ))}
            {upcomingDeadlines.length > 0 && (
              <>
                <h3 style={{ color: GOLD, margin: "20px 0 12px", fontSize: 14 }}>📋 Later</h3>
                {upcomingDeadlines.slice(0, 10).map((d) => (
                  <DeadlineCard key={d.id} deadline={d} onToggleMet={toggleMet} onClick={() => setSelectedEvent(d)} compact />
                ))}
              </>
            )}
            {metDeadlines.length > 0 && (
              <>
                <h3 style={{ color: GREEN, margin: "20px 0 12px", fontSize: 14 }}>✅ Met ({metDeadlines.length})</h3>
                {metDeadlines.slice(0, 5).map((d) => (
                  <DeadlineCard key={d.id} deadline={d} onToggleMet={toggleMet} onClick={() => setSelectedEvent(d)} compact met />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {view === "deadlines" && (
        <DeadlinesView deadlines={deadlines} onToggleMet={toggleMet} onSelect={setSelectedEvent} />
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onToggleMet={toggleMet} />
      )}
    </div>
  );
}

function DeadlineCard({ deadline, onToggleMet, onClick, compact, met }) {
  const d = deadline;
  const color = urgencyColor(d.days_remaining);
  const caseName = d.cases?.client_name || d.caseName || null;

  return (
    <div style={{
      background: CARD_BG, borderRadius: 8, padding: compact ? 10 : 14, marginBottom: 8,
      borderLeft: `4px solid ${met ? GREEN : color}`,
      opacity: met ? 0.6 : 1,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <button onClick={(e) => { e.stopPropagation(); onToggleMet(d); }} style={{
        width: 24, height: 24, borderRadius: 6, border: `2px solid ${met ? GREEN : color}`,
        background: met ? GREEN : "transparent", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", flexShrink: 0,
      }}>
        {met || d.is_met ? "✓" : ""}
      </button>
      <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={onClick}>
        <div style={{
          fontSize: compact ? 12 : 13, color: TEXT, fontWeight: 600,
          textDecoration: met || d.is_met ? "line-through" : "none",
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          {TYPE_ICONS[d.event_type] || "📅"} {d.subject}
        </div>
        {caseName && <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>{caseName}</div>}
        {!compact && (
          <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>
            {new Date(d.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
      </div>
      <div style={{
        fontSize: compact ? 12 : 14, fontWeight: 700, color: met ? GREEN : color,
        whiteSpace: "nowrap", flexShrink: 0,
      }}>
        {met || d.is_met ? "✅ Met" : countdownText(d.days_remaining)}
      </div>
    </div>
  );
}

function DeadlinesView({ deadlines, onToggleMet, onSelect }) {
  const unmet = deadlines.filter(d => !d.is_met).sort((a, b) => a.days_remaining - b.days_remaining);
  const met = deadlines.filter(d => d.is_met);

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ color: GOLD, margin: "0 0 20px", fontSize: 20 }}>All Deadlines & Key Dates</h2>

      {unmet.length === 0 && <p style={{ color: TEXT_DIM }}>No upcoming deadlines</p>}
      {unmet.map((d) => (
        <DeadlineCard key={d.id} deadline={d} onToggleMet={onToggleMet} onClick={() => onSelect(d)} />
      ))}

      {met.length > 0 && (
        <>
          <h3 style={{ color: GREEN, margin: "24px 0 12px", fontSize: 16 }}>✅ Completed ({met.length})</h3>
          {met.map((d) => (
            <DeadlineCard key={d.id} deadline={d} onToggleMet={onToggleMet} onClick={() => onSelect(d)} met />
          ))}
        </>
      )}
    </div>
  );
}

function EventModal({ event, onClose, onToggleMet }) {
  const e = event;
  const type = e.event_type || guessType(e.subject);
  const startTime = e.start_time || e.start?.dateTime || e.start;
  const endTime = e.end_time || e.end?.dateTime || e.end;
  const caseName = e.cases?.client_name || e.caseName || null;
  const isDeadlineType = ["deadline", "sol", "hearing", "deposition"].includes(type);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div onClick={(ev) => ev.stopPropagation()} style={{
        background: "#000055", borderRadius: 12, padding: 24, maxWidth: 500,
        width: "90%", border: `1px solid ${TYPE_COLORS[type]}44`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <h3 style={{ margin: 0, color: GOLD, fontSize: 18 }}>{TYPE_ICONS[type]} {e.subject}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_DIM, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: "#ccc" }}>
          <p><strong>Start:</strong> {new Date(startTime).toLocaleString()}</p>
          <p><strong>End:</strong> {new Date(endTime).toLocaleString()}</p>
          {e.location && <p><strong>Location:</strong> {e.location}</p>}
          {(e.bodyPreview || e.body_preview) && <p style={{ color: "#aaa" }}>{e.bodyPreview || e.body_preview}</p>}
          {caseName && <p><strong>Case:</strong> {caseName}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
            <span style={{
              padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: TYPE_COLORS[type] + "44", color: TYPE_COLORS[type],
            }}>
              {type.toUpperCase()}
            </span>
            {e.days_remaining != null && (
              <span style={{
                padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: urgencyColor(e.days_remaining) + "33",
                color: urgencyColor(e.days_remaining),
              }}>
                {countdownText(e.days_remaining)}
              </span>
            )}
          </div>
          {isDeadlineType && e.id && (
            <button onClick={() => onToggleMet(e)} style={{
              marginTop: 16, padding: "10px 20px", borderRadius: 8, border: "none",
              background: e.is_met ? "#5a1a1a" : GREEN, color: "#fff",
              cursor: "pointer", fontSize: 14, fontWeight: 600, width: "100%",
            }}>
              {e.is_met ? "↩️ Mark as NOT Met" : "✅ Mark as Met"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtn = { background: "#000066", border: "1px solid #333", color: "#ebb003", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 16 };
