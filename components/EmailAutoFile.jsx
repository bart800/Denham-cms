"use client";
import { useState, useEffect, useCallback } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050", greenBg: "rgba(56,111,74,0.12)", goldBg: "rgba(235,176,3,0.1)",
};
const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 },
  input: {
    background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6,
    padding: "8px 12px", color: B.txt, fontSize: 13, outline: "none",
    width: "100%", fontFamily: "'DM Sans',sans-serif",
  },
  btn: {
    background: B.gold, color: "#000", border: "none", borderRadius: 6,
    padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
  },
  btnO: {
    background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6,
    padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
    color: B.txtM, fontFamily: "'DM Sans',sans-serif",
  },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
  th: {
    textAlign: "left", padding: "10px 16px", borderBottom: `1px solid ${B.bdr}`,
    color: B.txtD, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
  },
  td: { padding: "10px 16px", borderBottom: `1px solid ${B.bdr}06` },
};

function StatCard({ label, value, color }) {
  return (
    <div style={S.card}>
      <div style={{ fontSize: 11, color: B.txtM, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, ...S.mono }}>{value}</div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  const now = new Date();
  const diff = now - dt;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function EmailAutoFile() {
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState({});
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [caseSearch, setCaseSearch] = useState({});
  const [caseResults, setCaseResults] = useState({});
  const [expanded, setExpanded] = useState(null);

  const [autoFiling, setAutoFiling] = useState(false);
  const [autoFileResult, setAutoFileResult] = useState(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/emails/auto-file?${params}`);
      const data = await res.json();
      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setSuggestions(data.suggestions || {});
    } catch { setEmails([]); }
    setLoading(false);
  }, [search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/emails/stats");
      setStats(await res.json());
    } catch { }
  }, []);

  useEffect(() => { loadEmails(); loadStats(); }, [loadEmails, loadStats]);

  // Auto-file emails with high confidence (>=80)
  const autoFileHighConfidence = async () => {
    const assignments = [];
    for (const email of emails) {
      const sugs = suggestions[email.id] || [];
      const best = sugs[0];
      if (best && best.confidence >= 80) {
        assignments.push({ emailId: email.id, caseId: best.id, confidence: best.confidence });
      }
    }
    if (assignments.length === 0) { setAutoFileResult("No emails with ≥80% confidence"); return; }
    setAutoFiling(true);
    try {
      const res = await fetch("/api/emails/auto-file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const data = await res.json();
      setAutoFileResult(`Filed ${data.filed} of ${data.total} emails`);
      loadEmails(); loadStats();
    } catch { setAutoFileResult("Error auto-filing"); }
    setAutoFiling(false);
  };

  const assignEmail = async (emailId, caseId) => {
    setAssigning(emailId);
    try {
      const res = await fetch("/api/emails/auto-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, caseId }),
      });
      if (res.ok) {
        setEmails(prev => prev.filter(e => e.id !== emailId));
        setTotal(prev => prev - 1);
        loadStats();
      }
    } catch { }
    setAssigning(null);
  };

  const searchCases = async (emailId, query) => {
    if (!query || query.length < 2) { setCaseResults(prev => ({ ...prev, [emailId]: [] })); return; }
    try {
      const res = await fetch(`/api/cases?search=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setCaseResults(prev => ({ ...prev, [emailId]: Array.isArray(data) ? data : data.cases || [] }));
    } catch { }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📧 Email Filing</h2>
        {emails.length > 0 && (() => {
          const highConf = emails.filter(e => (suggestions[e.id] || [])[0]?.confidence >= 80).length;
          return highConf > 0 ? (
            <button onClick={autoFileHighConfidence} disabled={autoFiling}
              style={{ ...S.btn, background: B.green, color: "#fff", fontSize: 13 }}>
              {autoFiling ? "Filing..." : `⚡ Auto-file ${highConf} high-confidence email${highConf !== 1 ? "s" : ""}`}
            </button>
          ) : null;
        })()}
        {autoFileResult && <span style={{ fontSize: 12, color: B.gold }}>{autoFileResult}</span>}
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Emails" value={stats.total} color={B.txt} />
          <StatCard label="Matched" value={stats.matched} color={B.green} />
          <StatCard label="Unmatched" value={stats.unmatched} color={B.danger} />
          <StatCard label="Match Rate" value={stats.total ? `${Math.round((stats.matched / stats.total) * 100)}%` : "—"} color={B.gold} />
        </div>
      )}

      {/* Match methods breakdown */}
      {stats?.byMethod && Object.keys(stats.byMethod).length > 0 && (
        <div style={{ ...S.card, marginBottom: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: B.txtD, fontWeight: 600 }}>BY METHOD:</span>
          {Object.entries(stats.byMethod).map(([method, count]) => (
            <span key={method} style={{ fontSize: 12, color: B.txtM }}>
              <span style={{ color: B.gold, fontWeight: 600 }}>{count}</span> {method}
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by subject, sender, or recipient..."
          style={{ ...S.input, flex: 1 }}
        />
        <button type="submit" style={S.btn}>Search</button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }} style={S.btnO}>Clear</button>
        )}
      </form>

      {/* Unmatched count */}
      <div style={{ fontSize: 13, color: B.txtM, marginBottom: 12 }}>
        {total} unmatched email{total !== 1 ? "s" : ""} {search && `matching "${search}"`}
      </div>

      {/* Email list */}
      {loading ? (
        <div style={{ ...S.card, textAlign: "center", padding: 40, color: B.txtD }}>Loading...</div>
      ) : emails.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, color: B.txtM }}>All emails are filed!</div>
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>From</th>
                <th style={S.th}>Subject</th>
                <th style={S.th}>Suggestions</th>
                <th style={S.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {emails.map(email => {
                const sugs = suggestions[email.id] || [];
                const isExpanded = expanded === email.id;
                return (
                  <tr key={email.id} style={{ background: isExpanded ? `${B.gold}08` : "transparent" }}>
                    <td style={{ ...S.td, whiteSpace: "nowrap", color: B.txtD, ...S.mono, fontSize: 11 }}>{fmtDate(email.received_at)}</td>
                    <td style={{ ...S.td, color: B.txtM, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.from_address}</td>
                    <td style={{ ...S.td, color: B.txt, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                      onClick={() => setExpanded(isExpanded ? null : email.id)}
                      title={email.subject}>
                      {email.direction === "inbound" ? "📥" : "📤"} {email.subject || "(no subject)"}
                    </td>
                    <td style={S.td}>
                      {sugs.length > 0 ? sugs.slice(0, 3).map(c => (
                        <button key={c.id} onClick={() => assignEmail(email.id, c.id)}
                          disabled={assigning === email.id}
                          title={c.reasons ? c.reasons.join(", ") : ""}
                          style={{ ...S.btnO, fontSize: 11, padding: "3px 8px", marginRight: 4, marginBottom: 2, color: c.confidence >= 80 ? B.green : c.confidence >= 50 ? B.gold : B.txtM, borderColor: c.confidence >= 80 ? `${B.green}60` : `${B.gold}40` }}>
                          {c.client_name || c.case_number}
                          <span style={{ ...S.mono, fontSize: 9, marginLeft: 4, opacity: 0.7 }}>{c.confidence}%</span>
                        </button>
                      )) : <span style={{ fontSize: 11, color: B.txtD }}>No matches</span>}
                    </td>
                    <td style={S.td}>
                      <button onClick={() => setExpanded(isExpanded ? null : email.id)}
                        style={{ ...S.btnO, fontSize: 11, padding: "4px 10px" }}>
                        {isExpanded ? "Close" : "Assign"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Expanded assign panel */}
          {expanded && (() => {
            const email = emails.find(e => e.id === expanded);
            if (!email) return null;
            return (
              <div style={{ padding: 20, borderTop: `1px solid ${B.bdr}`, background: `${B.gold}05` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>FROM</div>
                    <div style={{ fontSize: 13, color: B.txt }}>{email.from_address}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>TO</div>
                    <div style={{ fontSize: 13, color: B.txt }}>{email.to_address}</div>
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>SUBJECT</div>
                    <div style={{ fontSize: 13, color: B.txt }}>{email.subject}</div>
                  </div>
                  {email.body_text && (
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>PREVIEW</div>
                      <div style={{ fontSize: 12, color: B.txtM, maxHeight: 80, overflow: "hidden", lineHeight: 1.5 }}>
                        {email.body_text.slice(0, 300)}{email.body_text.length > 300 ? "..." : ""}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: B.txtM, marginBottom: 8 }}>Search for a case to assign:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={caseSearch[email.id] || ""}
                    onChange={e => {
                      const v = e.target.value;
                      setCaseSearch(prev => ({ ...prev, [email.id]: v }));
                      searchCases(email.id, v);
                    }}
                    placeholder="Type client name or case number..."
                    style={{ ...S.input, flex: 1, maxWidth: 400 }}
                  />
                </div>
                {(caseResults[email.id] || []).length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {caseResults[email.id].map(c => (
                      <button key={c.id} onClick={() => assignEmail(email.id, c.id)}
                        disabled={assigning === email.id}
                        style={{ ...S.btn, fontSize: 12, padding: "6px 14px" }}>
                        {c.client_name || c.case_number} {c.status ? `(${c.status})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
