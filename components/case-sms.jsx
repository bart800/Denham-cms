"use client";

import { useState, useEffect, useCallback } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  sms: "#2ecc71",
};

export default function CaseSMS({ caseId, clientPhone, user }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ to: clientPhone || "", message: "" });

  const fetchSms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/sms`);
      const data = await res.json();
      setMessages(data.sms || []);
    } catch (err) {
      console.error("Failed to fetch SMS:", err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchSms(); }, [fetchSms]);

  const handleSend = async () => {
    if (!form.to || !form.message) {
      setResult({ error: "Phone number and message are required" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: form.to,
          message: form.message,
          userId: user?.id,
          userName: user?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send SMS");
      setResult({ success: "SMS sent successfully" });
      setForm(f => ({ ...f, message: "" }));
      setTimeout(() => { setShowCompose(false); setResult(null); fetchSms(); }, 1500);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 6,
    border: "1px solid #333", backgroundColor: "#1a1a2e",
    color: "#e0e0e0", fontSize: 13,
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: B.txt, fontSize: 16 }}>📱 SMS Messages</h3>
        <button onClick={() => { setShowCompose(true); setResult(null); setForm({ to: clientPhone || "", message: "" }); }}
          style={{ padding: "6px 14px", borderRadius: 6, border: "none", backgroundColor: B.sms, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          💬 Send SMS
        </button>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowCompose(false)}>
          <div style={{ background: "#111128", borderRadius: 12, padding: 24, width: "90%", maxWidth: 500, border: `1px solid ${B.sms}40` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: B.sms, fontSize: 16 }}>📱 Send SMS</h3>
              <button onClick={() => setShowCompose(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>Phone Number *</label>
                <input style={inputStyle} value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} placeholder="+1234567890" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>Message * <span style={{ color: "#555" }}>({(form.message || "").length}/160)</span></label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Type your message..." maxLength={1600} />
              </div>
            </div>

            {result && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 10,
                background: result.success ? "#0a2a0a" : "#2a0a0a",
                color: result.success ? B.green : "#e74c3c",
                fontSize: 13 }}>
                {result.success || result.error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCompose(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", backgroundColor: "#333", color: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSend} disabled={sending}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", backgroundColor: B.sms, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                {sending ? "Sending..." : "📤 Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS History */}
      {loading ? (
        <p style={{ color: "#888", fontSize: 13 }}>Loading SMS history...</p>
      ) : messages.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13 }}>No SMS messages for this case.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {messages.map(sms => (
            <div key={sms.id} style={{ backgroundColor: "#111128", borderRadius: 8, padding: "10px 14px", border: "1px solid #222", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{
                display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: "#fff",
                backgroundColor: sms.direction === "inbound" ? "#2563eb" : B.sms, flexShrink: 0, marginTop: 2,
              }}>
                {sms.direction === "inbound" ? "↓ IN" : "↑ OUT"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#e0e0e0", marginBottom: 4 }}>{sms.message}</div>
                <div style={{ fontSize: 11, color: "#666", display: "flex", gap: 12 }}>
                  <span>{sms.phone_number}</span>
                  <span>{formatDate(sms.created_at)}</span>
                  {sms.sent_by && <span>by {sms.sent_by}</span>}
                  {sms.status && sms.status !== "sent" && <span style={{ color: B.gold }}>{sms.status}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
