"use client";
import { useState, useEffect } from "react";

const ROLES = ["Attorney", "Paralegal", "Legal Assistant", "Office Manager", "Intern"];

export default function TeamInvitePanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Paralegal");
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/team/invites");
      const data = await res.json();
      setInvites(data.invites || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvites(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const emailMsg = data.emailSent ? "Invite email sent!" : "Invite created! Copy the link below to send manually.";
      setMessage({ type: "success", text: emailMsg, link: data.link });
      setEmail("");
      fetchInvites();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await fetch(`/api/team/invites?id=${id}`, { method: "DELETE" });
      fetchInvites();
    } catch (e) {
      console.error(e);
    }
  };

  const copyLink = (token) => {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/onboard?token=${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const statusBadge = (status) => {
    const colors = {
      pending: { bg: "rgba(235,176,3,0.15)", text: "#ebb003" },
      accepted: { bg: "rgba(126,184,126,0.15)", text: "#7eb87e" },
      revoked: { bg: "rgba(224,108,117,0.15)", text: "#e06c75" },
      expired: { bg: "rgba(160,160,176,0.15)", text: "#a0a0b0" },
    };
    const c = colors[status] || colors.expired;
    return (
      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>
        {status}
      </span>
    );
  };

  const inputStyle = {
    padding: "10px 14px", background: "#08080f", border: "1px solid #1e1e2e",
    borderRadius: 8, color: "#e8e8f0", fontSize: 14, outline: "none",
  };

  return (
    <div>
      <h3 style={{ color: "#e8e8f0", margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>
        Team Invites
      </h3>

      {/* Invite Form */}
      <form onSubmit={handleInvite} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 200px" }}
          type="email"
          placeholder="colleague@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          style={{ ...inputStyle, minWidth: 140 }}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: "10px 20px", background: "#ebb003", color: "#08080f",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
            cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? "Sending..." : "Send Invite"}
        </button>
      </form>

      {/* Message */}
      {message && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14,
          background: message.type === "success" ? "rgba(126,184,126,0.1)" : "rgba(224,108,117,0.1)",
          border: `1px solid ${message.type === "success" ? "rgba(126,184,126,0.3)" : "rgba(224,108,117,0.3)"}`,
          color: message.type === "success" ? "#7eb87e" : "#e06c75",
        }}>
          {message.text}
          {message.link && (
            <button
              onClick={() => { navigator.clipboard.writeText(message.link); setCopied("msg"); setTimeout(() => setCopied(null), 2000); }}
              style={{ marginLeft: 12, background: "none", border: "1px solid currentColor", borderRadius: 6, padding: "2px 10px", color: "inherit", cursor: "pointer", fontSize: 12 }}
            >
              {copied === "msg" ? "Copied!" : "Copy Link"}
            </button>
          )}
        </div>
      )}

      {/* Invites List */}
      {loading ? (
        <p style={{ color: "#a0a0b0", fontSize: 14 }}>Loading invites...</p>
      ) : invites.length === 0 ? (
        <p style={{ color: "#a0a0b0", fontSize: 14 }}>No invites yet. Send the first one above!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invites.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "#08080f", border: "1px solid #1e1e2e",
                borderRadius: 10, flexWrap: "wrap", gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: "#e8e8f0", fontSize: 14, fontWeight: 500 }}>{inv.email}</div>
                <div style={{ color: "#a0a0b0", fontSize: 12, marginTop: 2 }}>
                  {inv.role} • {new Date(inv.created_at).toLocaleDateString()}
                  {inv.inviter?.name && ` • by ${inv.inviter.name}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {statusBadge(inv.status)}
                {inv.status === "pending" && (
                  <>
                    <button
                      onClick={() => copyLink(inv.token)}
                      style={{
                        background: "none", border: "1px solid #1e1e2e", borderRadius: 6,
                        padding: "4px 12px", color: "#a0a0b0", cursor: "pointer", fontSize: 12,
                      }}
                    >
                      {copied === inv.token ? "✓ Copied" : "Copy Link"}
                    </button>
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      style={{
                        background: "none", border: "1px solid rgba(224,108,117,0.3)", borderRadius: 6,
                        padding: "4px 12px", color: "#e06c75", cursor: "pointer", fontSize: 12,
                      }}
                    >
                      Revoke
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
