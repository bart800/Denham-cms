"use client";

import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";

export default function CaseEmails({ caseId }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [form, setForm] = useState({
    subject: "",
    from_address: "",
    to_address: "",
    cc_address: "",
    body_text: "",
    direction: "inbound",
    received_at: new Date().toISOString().slice(0, 16),
  });

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/emails?page=${page}&limit=25`);
      const data = await res.json();
      setEmails(data.emails || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    } finally {
      setLoading(false);
    }
  }, [caseId, page]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/cases/${caseId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, received_at: new Date(form.received_at).toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to log email");
      setShowForm(false);
      setForm({ subject: "", from_address: "", to_address: "", cc_address: "", body_text: "", direction: "inbound", received_at: new Date().toISOString().slice(0, 16) });
      fetchEmails();
    } catch (err) {
      alert(err.message);
    }
  };

  const directionBadge = (dir) => (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: "11px",
      fontWeight: 600,
      color: "#fff",
      backgroundColor: dir === "inbound" ? "#2563eb" : GOLD,
    }}>
      {dir === "inbound" ? "↓ IN" : "↑ OUT"}
    </span>
  );

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #333",
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    fontSize: "13px",
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: "#e0e0e0", fontSize: "16px" }}>📧 Emails</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: GREEN,
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Log Email"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ backgroundColor: "#111128", borderRadius: "8px", padding: "16px", marginBottom: "16px", border: `1px solid ${NAVY}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>From</label>
              <input style={inputStyle} value={form.from_address} onChange={(e) => setForm({ ...form, from_address: e.target.value })} placeholder="sender@example.com" required />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>To</label>
              <input style={inputStyle} value={form.to_address} onChange={(e) => setForm({ ...form, to_address: e.target.value })} placeholder="recipient@example.com" required />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>Subject</label>
              <input style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" required />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>CC</label>
              <input style={inputStyle} value={form.cc_address} onChange={(e) => setForm({ ...form, cc_address: e.target.value })} placeholder="cc@example.com" />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>Direction</label>
              <select style={inputStyle} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>Date/Time</label>
              <input type="datetime-local" style={inputStyle} value={form.received_at} onChange={(e) => setForm({ ...form, received_at: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "11px", color: "#999", marginBottom: "2px", display: "block" }}>Body</label>
            <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} placeholder="Email body..." />
          </div>
          <button type="submit" style={{ padding: "8px 20px", borderRadius: "6px", border: "none", backgroundColor: NAVY, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Save Email
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: "#888", fontSize: "13px" }}>Loading emails...</p>
      ) : emails.length === 0 ? (
        <p style={{ color: "#888", fontSize: "13px" }}>No emails logged for this case.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {emails.map((email) => (
            <div key={email.id} style={{ backgroundColor: "#111128", borderRadius: "8px", border: `1px solid ${expandedId === email.id ? NAVY : "#222"}`, overflow: "hidden" }}>
              <div
                onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}
              >
                {directionBadge(email.direction)}
                <span style={{ color: "#e0e0e0", fontSize: "13px", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {email.subject || "(no subject)"}
                </span>
                <span style={{ color: "#999", fontSize: "12px", whiteSpace: "nowrap" }}>{email.from_address}</span>
                <span style={{ color: "#666", fontSize: "11px", whiteSpace: "nowrap" }}>{formatDate(email.received_at)}</span>
              </div>
              {expandedId === email.id && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #222" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "12px", color: "#999", padding: "10px 0" }}>
                    <span>From:</span><span style={{ color: "#ccc" }}>{email.from_address}</span>
                    <span>To:</span><span style={{ color: "#ccc" }}>{email.to_address}</span>
                    {email.cc_address && <><span>CC:</span><span style={{ color: "#ccc" }}>{email.cc_address}</span></>}
                  </div>
                  <div style={{ backgroundColor: "#0a0a1a", borderRadius: "6px", padding: "12px", fontSize: "13px", color: "#ccc", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {email.body_html ? (
                      <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
                    ) : (
                      email.body_text || "(no body)"
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "8px" }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "4px 12px", borderRadius: "4px", border: "1px solid #333", backgroundColor: "#1a1a2e", color: "#ccc", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>← Prev</button>
              <span style={{ color: "#888", fontSize: "12px", alignSelf: "center" }}>Page {page} of {pagination.totalPages}</span>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} style={{ padding: "4px 12px", borderRadius: "4px", border: "1px solid #333", backgroundColor: "#1a1a2e", color: "#ccc", cursor: page >= pagination.totalPages ? "default" : "pointer", opacity: page >= pagination.totalPages ? 0.4 : 1 }}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
