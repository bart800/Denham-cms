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

const REFRESH_MS = 5 * 60 * 1000;

export default function AlertsPanel({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all"); // all | unread
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/list");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAsRead = async (ids) => {
    try {
      await fetch("/api/notifications/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - ids.filter(id => !id.startsWith("sol-")).length));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const filtered = tab === "unread" ? notifications.filter(n => !n.is_read) : notifications;
  const criticalCount = notifications.filter(n => n.severity === "critical" && !n.is_read).length;

  // Group by severity
  const grouped = {};
  for (const n of filtered) {
    (grouped[n.severity] = grouped[n.severity] || []).push(n);
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
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
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
            {unreadCount > 99 ? "99+" : unreadCount}
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
            width: 400,
            maxHeight: 520,
            overflowY: "auto",
            background: COLORS.bgPanel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, color: COLORS.gold, fontSize: 14 }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Tab toggles */}
              <button
                onClick={() => setTab("all")}
                style={{ background: tab === "all" ? COLORS.navy : "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 4, color: tab === "all" ? COLORS.gold : COLORS.textMuted, fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
              >All</button>
              <button
                onClick={() => setTab("unread")}
                style={{ background: tab === "unread" ? COLORS.navy : "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 4, color: tab === "unread" ? COLORS.gold : COLORS.textMuted, fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
              >Unread</button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ background: "transparent", border: "none", color: COLORS.green, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                >Mark all read</button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
              {tab === "unread" ? "No unread notifications" : "No notifications"}
            </div>
          ) : (
            severityOrder.map((sev) => {
              const items = grouped[sev];
              if (!items?.length) return null;
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev}>
                  <div style={{
                    padding: "8px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    color: cfg.color, letterSpacing: 1, borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.15)",
                  }}>
                    {cfg.icon} {cfg.label} ({items.length})
                  </div>
                  {items.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (onNavigate && notif.case_id) onNavigate(notif.case_id);
                        if (!notif.is_read) markAsRead([notif.id]);
                        setOpen(false);
                      }}
                      style={{
                        padding: "10px 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        cursor: notif.case_id ? "pointer" : "default",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        opacity: notif.is_read ? 0.6 : 1,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {!notif.is_read && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, marginTop: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ borderLeft: `3px solid ${cfg.color}`, paddingLeft: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{notif.title}</div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                          {notif.description}
                        </div>
                        {notif.cases && (
                          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                            📁 {notif.cases.ref} — {notif.cases.client_name}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                          {notif.is_live ? "Live" : formatTimeAgo(notif.created_at)}
                          {notif.type && ` · ${notif.type.replace(/_/g, " ")}`}
                        </div>
                      </div>
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

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
