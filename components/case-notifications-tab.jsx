"use client";
import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const DARK_BG = "#0a0a2e";
const CARD_BG = "#000044";
const TEXT = "#e0e0e0";
const BORDER = "#1a1a5e";
const RED = "#cc3333";

const TYPE_LABELS = {
  phase_change: { label: "Phase Change", icon: "🔄", color: "#4488cc" },
  document_uploaded: { label: "Document", icon: "📄", color: GREEN },
  task_milestone: { label: "Milestone", icon: "✅", color: GOLD },
  general: { label: "General", icon: "📬", color: "#888" },
  appointment_reminder: { label: "Appointment", icon: "📅", color: "#9966cc" },
};

const STATUS_COLORS = {
  sent: GREEN,
  failed: RED,
  pending: GOLD,
  sending: "#4488cc",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CaseNotificationsTab({ caseId, caseData }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(caseData?.portal_notifications_enabled !== false);
  const [toggling, setToggling] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/notifications?case_id=${caseId}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [caseId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const toggleNotifications = async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_notifications_enabled: !notificationsEnabled }),
      });
      if (res.ok) setNotificationsEnabled(!notificationsEnabled);
    } catch (e) { console.error(e); }
    setToggling(false);
  };

  const sendNotification = async () => {
    if (!composeSubject.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/portal/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          type: "general",
          subject: composeSubject,
          message: composeMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCompose(false);
        setComposeSubject("");
        setComposeMessage("");
        fetchNotifications();
      } else {
        alert(data.error || "Failed to send");
      }
    } catch (e) { alert(e.message); }
    setSending(false);
  };

  return (
    <div style={{ color: TEXT }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: GOLD }}>📬 Client Notifications</h3>
          <span style={{ fontSize: 12, color: "#888" }}>{total} sent</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Toggle */}
          <button onClick={toggleNotifications} disabled={toggling} style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
            background: notificationsEnabled ? GREEN : "#444",
            color: "#fff", border: "none", opacity: toggling ? 0.6 : 1,
          }}>
            {notificationsEnabled ? "✓ Auto-Notify ON" : "✗ Auto-Notify OFF"}
          </button>
          {/* Compose */}
          <button onClick={() => setShowCompose(!showCompose)} style={{
            padding: "6px 14px", borderRadius: 6, background: NAVY, color: GOLD,
            border: `1px solid ${GOLD}`, fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>
            {showCompose ? "Cancel" : "✉ Send Notification"}
          </button>
        </div>
      </div>

      {/* Compose Form */}
      {showCompose && (
        <div style={{
          background: CARD_BG, border: `1px solid ${GOLD}`, borderRadius: 8,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Subject</label>
            <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
              placeholder="Email subject..." style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${BORDER}`,
                background: DARK_BG, color: TEXT, fontSize: 14, boxSizing: "border-box",
              }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Message</label>
            <textarea value={composeMessage} onChange={e => setComposeMessage(e.target.value)}
              placeholder="Write your message to the client..." rows={4} style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${BORDER}`,
                background: DARK_BG, color: TEXT, fontSize: 14, resize: "vertical", boxSizing: "border-box",
              }} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 11, color: "#888", alignSelf: "center" }}>
              Sending to: {caseData?.portal_email || "No email on file"}
            </span>
            <button onClick={sendNotification} disabled={sending || !composeSubject.trim()} style={{
              padding: "8px 20px", borderRadius: 6, background: sending ? "#444" : GREEN,
              color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      )}

      {/* Notification History */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: GOLD }}>Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
          No notifications sent yet. Use the button above to send a client notification.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {notifications.map((n) => {
            const typeInfo = TYPE_LABELS[n.type] || TYPE_LABELS.general;
            return (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: CARD_BG, borderRadius: 6, border: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 20 }}>{typeInfo.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.subject}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 8 }}>
                    <span style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                    <span>→ {n.sent_to}</span>
                    <span>{timeAgo(n.sent_at)}</span>
                  </div>
                </div>
                <span style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: STATUS_COLORS[n.status] || "#444", color: "#fff",
                }}>
                  {n.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
