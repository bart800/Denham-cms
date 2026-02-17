"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const COLORS = {
  navy: "#000066",
  gold: "#ebb003",
  green: "#386f4a",
  danger: "#e04050",
  bg: "#1a1a2e",
  bgPanel: "#16213e",
  border: "#0f3460",
  text: "#e0e0e0",
  textMuted: "#999",
};

const SEVERITY_CONFIG = {
  critical: { color: COLORS.danger, icon: "🔴", label: "Critical" },
  warning: { color: COLORS.gold, icon: "🟡", label: "Warning" },
  info: { color: COLORS.green, icon: "🟢", label: "Info" },
};

const DISMISS_KEY = "denham-alerts-dismissed";
const REFRESH_MS = 5 * 60 * 1000;

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

function setDismissed(ids) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
}

export default function AlertsPanel({ onNavigate }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissedState] = useState([]);
  const panelRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setDismissedState(getDismissed());
    fetchAlerts();
    const iv = setInterval(fetchAlerts, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  const count = visible.length;
  const criticalCount = visible.filter((a) => a.severity === "critical").length;

  const dismiss = (id, e) => {
    e.stopPropagation();
    const next = [...dismissed, id];
    setDismissedState(next);
    setDismissed(next);
  };

  const grouped = {};
  for (const a of visible) {
    (grouped[a.severity] = grouped[a.severity] || []).push(a);
  }
  const severityOrder = ["critical", "warning", "info"];

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "8px",
          fontSize: "20px",
          color: COLORS.text,
        }}
        title="Alerts"
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: criticalCount > 0 ? COLORS.danger : COLORS.gold,
              color: "#fff",
              borderRadius: "50%",
              width: 18,
              height: 18,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            width: 380,
            maxHeight: 480,
            overflowY: "auto",
            background: COLORS.bgPanel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${COLORS.border}`,
              fontWeight: 600,
              color: COLORS.gold,
              fontSize: 14,
            }}
          >
            Alerts {count > 0 && `(${count})`}
          </div>

          {count === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
              No active alerts
            </div>
          ) : (
            severityOrder.map((sev) => {
              const items = grouped[sev];
              if (!items?.length) return null;
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev}>
                  <div
                    style={{
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: cfg.color,
                      letterSpacing: 1,
                      borderBottom: `1px solid ${COLORS.border}`,
                      background: "rgba(0,0,0,0.15)",
                    }}
                  >
                    {cfg.icon} {cfg.label} ({items.length})
                  </div>
                  {items.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        if (onNavigate && alert.case_id) onNavigate(alert.case_id);
                        setOpen(false);
                      }}
                      style={{
                        padding: "10px 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        cursor: alert.case_id ? "pointer" : "default",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ borderLeft: `3px solid ${cfg.color}`, paddingLeft: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{alert.title}</div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                          {alert.description}
                        </div>
                      </div>
                      <button
                        onClick={(e) => dismiss(alert.id, e)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: COLORS.textMuted,
                          cursor: "pointer",
                          fontSize: 16,
                          padding: "0 4px",
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
