"use client";

import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";

const EMAIL_TEMPLATES = {
  status_update: {
    label: "📋 Status Update",
    subject: "Case Status Update — {{REF}}",
    body: `<p>Dear {{CLIENT}},</p>
<p>I wanted to provide you with an update on the status of your case <strong>{{REF}}</strong>.</p>
<p>[Update details here]</p>
<p>Please don't hesitate to reach out if you have any questions.</p>
<p>Best regards,<br/>{{SENDER}}<br/>Denham Law</p>`,
  },
  document_request: {
    label: "📎 Document Request",
    subject: "Documents Needed — {{REF}}",
    body: `<p>Dear {{CLIENT}},</p>
<p>In order to continue processing your case <strong>{{REF}}</strong>, we need the following documents:</p>
<ul>
<li>[Document 1]</li>
<li>[Document 2]</li>
<li>[Document 3]</li>
</ul>
<p>Please provide these at your earliest convenience. You can reply to this email with the documents attached, or upload them through the client portal.</p>
<p>Thank you,<br/>{{SENDER}}<br/>Denham Law</p>`,
  },
  initial_contact: {
    label: "👋 Initial Contact",
    subject: "Welcome — {{REF}}",
    body: `<p>Dear {{CLIENT}},</p>
<p>Thank you for choosing Denham Law to represent you. This email confirms that we have opened your case file under reference <strong>{{REF}}</strong>.</p>
<p>Next steps:</p>
<ol>
<li>We will review the details of your case thoroughly</li>
<li>Our team will gather necessary documentation</li>
<li>We will schedule a follow-up call to discuss strategy</li>
</ol>
<p>If you have any questions in the meantime, please don't hesitate to contact us.</p>
<p>Welcome aboard,<br/>{{SENDER}}<br/>Denham Law</p>`,
  },
  settlement_followup: {
    label: "💰 Settlement Follow-Up",
    subject: "Settlement Offer Follow-Up — {{REF}}",
    body: `<p>Dear {{RECIPIENT}},</p>
<p>I am writing to follow up regarding the settlement offer on case <strong>{{REF}}</strong>.</p>
<p>As discussed, [settlement details]. We would appreciate a response by [date].</p>
<p>Please let us know if you need any additional information to facilitate this process.</p>
<p>Regards,<br/>{{SENDER}}<br/>Denham Law</p>`,
  },
};

export default function CaseEmails({ caseId, caseRef, clientName, clientEmail, adjusterEmail, user }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Log form (existing functionality)
  const [form, setForm] = useState({
    subject: "", from_address: "", to_address: "", cc_address: "",
    body_text: "", direction: "inbound",
    received_at: new Date().toISOString().slice(0, 16),
  });

  // Compose form (new send functionality)
  const [compose, setCompose] = useState({
    to: "", cc: "", bcc: "", subject: "", body: "",
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

  const ref = caseRef || "";

  const applyTemplate = (key) => {
    const tmpl = EMAIL_TEMPLATES[key];
    if (!tmpl) return;
    const sub = tmpl.subject.replace(/\{\{REF\}\}/g, ref);
    const bod = tmpl.body
      .replace(/\{\{REF\}\}/g, ref)
      .replace(/\{\{CLIENT\}\}/g, clientName || "[Client]")
      .replace(/\{\{SENDER\}\}/g, user?.name || "Team")
      .replace(/\{\{RECIPIENT\}\}/g, "[Recipient]");
    setCompose(c => ({ ...c, subject: sub, body: bod }));
  };

  const openCompose = (preset = {}) => {
    setCompose({
      to: preset.to || clientEmail || "",
      cc: preset.cc || "",
      bcc: preset.bcc || "",
      subject: preset.subject || (ref ? `Re: ${ref}` : ""),
      body: preset.body || "",
    });
    setShowCompose(true);
    setSendResult(null);
  };

  const openReply = (email) => {
    const subj = email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject || ""}`;
    const quote = `<br/><br/><hr/><p><strong>On ${formatDate(email.received_at)}, ${email.from_address} wrote:</strong></p><blockquote style="border-left:3px solid #666;padding-left:12px;color:#999;">${email.body_html || email.body_text || ""}</blockquote>`;
    openCompose({
      to: email.direction === "inbound" ? email.from_address : email.to_address,
      subject: subj,
      body: quote,
    });
  };

  const handleSend = async () => {
    if (!compose.to || !compose.subject) {
      setSendResult({ error: "To and Subject are required" });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: compose.to,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.subject,
          body: compose.body,
          userId: user?.id,
          userName: user?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSendResult({ success: `Email sent via ${data.sentVia}` });
      setTimeout(() => { setShowCompose(false); fetchEmails(); }, 1500);
    } catch (err) {
      setSendResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

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
      display: "inline-block", padding: "2px 8px", borderRadius: "4px",
      fontSize: "11px", fontWeight: 600, color: "#fff",
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
    width: "100%", padding: "8px 10px", borderRadius: "6px",
    border: "1px solid #333", backgroundColor: "#1a1a2e",
    color: "#e0e0e0", fontSize: "13px",
  };

  const btnStyle = (bg) => ({
    padding: "6px 14px", borderRadius: "6px", border: "none",
    backgroundColor: bg, color: "#fff", fontSize: "13px",
    fontWeight: 600, cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e0e0e0", fontSize: "16px" }}>📧 Emails</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => openCompose()} style={btnStyle(NAVY)}>✉️ New Email</button>
          <button onClick={() => setShowForm(!showForm)} style={btnStyle(GREEN)}>
            {showForm ? "Cancel" : "+ Log Email"}
          </button>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowCompose(false)}>
          <div style={{ background: "#111128", borderRadius: 12, padding: 24, width: "90%", maxWidth: 700, maxHeight: "90vh", overflow: "auto", border: `1px solid ${NAVY}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: GOLD, fontSize: 16 }}>✉️ Compose Email</h3>
              <button onClick={() => setShowCompose(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Template Selector */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#999", marginBottom: 4, display: "block" }}>Quick Template</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(EMAIL_TEMPLATES).map(([key, t]) => (
                  <button key={key} onClick={() => applyTemplate(key)}
                    style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #333", background: "#1a1a2e", color: "#ccc", fontSize: 12, cursor: "pointer" }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick recipients */}
            <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {clientEmail && (
                <button onClick={() => setCompose(c => ({ ...c, to: clientEmail }))}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #333", background: "#0a1a0a", color: GREEN, fontSize: 11, cursor: "pointer" }}>
                  👤 Client: {clientEmail}
                </button>
              )}
              {adjusterEmail && (
                <button onClick={() => setCompose(c => ({ ...c, to: adjusterEmail }))}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #333", background: "#1a1a0a", color: GOLD, fontSize: 11, cursor: "pointer" }}>
                  🏢 Adjuster: {adjusterEmail}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>To *</label>
                <input style={inputStyle} value={compose.to} onChange={e => setCompose(c => ({ ...c, to: e.target.value }))} placeholder="recipient@example.com" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>CC</label>
                  <input style={inputStyle} value={compose.cc} onChange={e => setCompose(c => ({ ...c, cc: e.target.value }))} placeholder="cc@example.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>BCC</label>
                  <input style={inputStyle} value={compose.bcc} onChange={e => setCompose(c => ({ ...c, bcc: e.target.value }))} placeholder="bcc@example.com" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>Subject *</label>
                <input style={inputStyle} value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} placeholder="Email subject" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>Body</label>
                <textarea style={{ ...inputStyle, minHeight: 200, resize: "vertical", lineHeight: 1.5 }}
                  value={compose.body} onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                  placeholder="Write your email..." />
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>HTML supported. Templates auto-fill above.</div>
              </div>
            </div>

            {sendResult && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 10,
                background: sendResult.success ? "#0a2a0a" : "#2a0a0a",
                color: sendResult.success ? GREEN : "#e74c3c",
                border: `1px solid ${sendResult.success ? GREEN : "#e74c3c"}40`,
                fontSize: 13 }}>
                {sendResult.success || sendResult.error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCompose(false)} style={btnStyle("#333")}>Cancel</button>
              <button onClick={handleSend} disabled={sending} style={{ ...btnStyle(NAVY), opacity: sending ? 0.6 : 1 }}>
                {sending ? "Sending..." : "📤 Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log form (existing) */}
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
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button onClick={() => openReply(email)} style={btnStyle(NAVY)}>↩️ Reply</button>
                    <button onClick={() => openCompose({ to: "", subject: `Fwd: ${email.subject || ""}`, body: `<br/><br/><hr/><p><strong>Forwarded message from ${email.from_address}:</strong></p>${email.body_html || email.body_text || ""}` })}
                      style={btnStyle("#333")}>➡️ Forward</button>
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
