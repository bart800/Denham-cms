"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as api from "../lib/api";

// ─── Brand Colors ───────────────────────────────────────────
const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", cardH: "#16161f",
  bdr: "#1e1e2e", bdrL: "#2a2a3a",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050", dangerBg: "rgba(224,64,80,0.1)",
  greenBg: "rgba(56,111,74,0.12)", goldBg: "rgba(235,176,3,0.1)",
  navyBg: "rgba(0,0,102,0.15)", purple: "#7c5cbf",
};

// ─── Constants ──────────────────────────────────────────────
const JURIS = ["KY", "TN", "MT", "NC", "TX", "CA", "WA", "CO", "NY"];
const CSTATS = ["Intake", "Investigation", "Presuit Demand", "Presuit Negotiation",
  "Litigation - Filed", "Litigation - Discovery", "Litigation - Mediation",
  "Litigation - Trial Prep", "Appraisal", "Settled", "Closed"];
const ATYPES = ["note", "call", "email", "task", "document", "negotiation",
  "pleading", "estimate", "status_change", "deadline"];
const DOC_CATEGORIES = ["Intake", "Correspondence", "Discovery", "Estimates",
  "E-Pleadings", "Photos", "Policy", "PA Files", "Pleadings"];

// ─── Shared Styles ──────────────────────────────────────────
const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 },
  badge: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
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
    padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
    color: B.txtM, fontFamily: "'DM Sans',sans-serif",
  },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "10px 16px", borderBottom: `1px solid ${B.bdr}`,
    color: B.txtD, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
  },
  td: { padding: "10px 16px", borderBottom: `1px solid ${B.bdr}06` },
  secT: { fontSize: 15, fontWeight: 700, color: B.txt, marginBottom: 16 },
};

// ─── Utilities ──────────────────────────────────────────────
const fmt = n => "$" + Number(n).toLocaleString("en-US");
const fmtD = d => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const dU = d => Math.ceil((new Date(d + "T00:00:00") - new Date()) / 86400000);
const fmtSize = bytes => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
};

function stClr(st) {
  if (!st) return { bg: "rgba(85,85,106,0.15)", t: B.txtD };
  if (st.includes("Intake")) return { bg: B.goldBg, t: B.gold };
  if (st.includes("Investigation")) return { bg: "rgba(91,141,239,0.12)", t: "#5b8def" };
  if (st.includes("Presuit")) return { bg: "rgba(235,176,3,0.12)", t: "#e0a050" };
  if (st.includes("Litigation")) return { bg: "rgba(0,0,102,0.2)", t: "#6b6bff" };
  if (st.includes("Appraisal")) return { bg: "rgba(124,92,191,0.12)", t: B.purple };
  if (st.includes("Settled")) return { bg: B.greenBg, t: B.green };
  return { bg: "rgba(85,85,106,0.15)", t: B.txtD };
}

function nClr(t) {
  return {
    bottom_line: B.gold, plaintiff_offer: B.green, defendant_offer: "#5b8def",
    presuit_demand: "#e0a050", settlement: "#50c878", undisputed_payment: "#7eb87e",
    denial: B.danger, appraisal_award: B.purple,
  }[t] || B.txtM;
}

function nLbl(t) { return (t || "").split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" "); }

function aIcon(t) {
  return {
    note: "✍️", call: "📞", email: "✉️", task: "✅", document: "📄",
    negotiation: "💰", pleading: "⚖️", estimate: "📊", status_change: "🔄", deadline: "⏰",
  }[t] || "•";
}

// ─── Supabase → Component Shape Transformer ─────────────────
function sbToCase(row) {
  const att = row.attorney || {};
  const sup = row.support || {};
  const cd = Array.isArray(row.claim_details) ? row.claim_details[0] : row.claim_details || {};
  const ld = Array.isArray(row.litigation_details) ? row.litigation_details[0] : row.litigation_details || null;
  return {
    id: row.id,
    ref: row.ref,
    client: row.client_name,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    type: row.type,
    status: row.status,
    juris: row.jurisdiction,
    attorney: { id: att.id, name: att.name || "Unassigned", role: att.role, title: att.title, ini: att.initials || "?", clr: att.color || "#888" },
    support: { id: sup.id, name: sup.name || "Unassigned", role: sup.role, title: sup.title, ini: sup.initials || "?", clr: sup.color || "#888" },
    dol: row.date_of_loss,
    dop: row.date_opened,
    sol: row.statute_of_limitations,
    insurer: row.insurer,
    cn: row.claim_number,
    pn: row.policy_number,
    totalRec: Number(row.total_recovery) || 0,
    attFees: Number(row.attorney_fees) || 0,
    cd: {
      policyNumber: cd?.policy_number || row.policy_number,
      claimNumber: cd?.claim_number || row.claim_number,
      insurer: cd?.insurer || row.insurer,
      adjuster: cd?.adjuster_name,
      adjPhone: cd?.adjuster_phone,
      adjEmail: cd?.adjuster_email,
      dateOfLoss: cd?.date_of_loss || row.date_of_loss,
      dateReported: cd?.date_reported,
      dateDenied: cd?.date_denied,
      policyType: cd?.policy_type,
      policyLimits: cd?.policy_limits,
      deductible: cd?.deductible,
      causeOfLoss: cd?.cause_of_loss,
      propAddr: cd?.property_address,
    },
    ld: ld ? {
      caseNum: ld.case_number, court: ld.court, judge: ld.judge,
      filedDate: ld.filed_date, oppCounsel: ld.opposing_counsel,
      oppFirm: ld.opposing_firm, oppPhone: ld.opposing_phone,
      oppEmail: ld.opposing_email, trialDate: ld.trial_date,
      medDate: ld.mediation_date, discDeadline: ld.discovery_deadline,
    } : null,
    negs: (row.negotiations || []).map(n => ({
      id: n.id, date: n.date, type: n.type,
      amount: Number(n.amount) || 0, notes: n.notes, by: n.by_name,
    })),
    ests: (row.estimates || []).map(e => ({
      id: e.id, date: e.date, type: e.type,
      amount: Number(e.amount) || 0, vendor: e.vendor, notes: e.notes,
    })),
    pleads: (row.pleadings || []).map(p => ({
      id: p.id, date: p.date, type: p.type,
      filedBy: p.filed_by, status: p.status, notes: p.notes, docUrl: p.doc_url,
    })),
    acts: (row.activity_log || []).map(a => ({
      id: a.id, date: a.date, time: a.time, type: a.type,
      actor: a.actor_name, aIni: a.actor_initials, aClr: a.actor_color,
      title: a.title, desc: a.description,
    })),
  };
}

// ═══════════════════════════════════════════════════════════
// AI COMMAND BAR (Cmd+K)
// ═══════════════════════════════════════════════════════════
function CommandBar({ open, onClose, onOpenCase, cases }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setResults(null);
      setDescription("");
    }
  }, [open]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, action: "command" }),
      });
      const data = await resp.json();
      if (data.error) {
        setDescription("Error: " + data.error);
        setResults([]);
      } else {
        setDescription(data.description || "");
        setResults(data.cases || []);
      }
    } catch (err) {
      setDescription("Failed to query: " + err.message);
      setResults([]);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "flex-start", justifyContent: "center", paddingTop: 120,
    }} onClick={onClose}>
      <div style={{
        width: 640, background: B.card, border: `1px solid ${B.bdr}`,
        borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${B.bdr}` }}>
          <span style={{ fontSize: 18, marginRight: 12, opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") onClose(); }}
            placeholder="Ask anything... e.g. 'State Farm cases in litigation' or 'SOL in next 90 days'"
            style={{ ...S.input, border: "none", background: "transparent", fontSize: 15, padding: 0 }}
          />
          {loading && <span style={{ fontSize: 12, color: B.gold }}>⏳</span>}
        </div>

        {/* Hint */}
        {!results && !loading && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${B.bdr}` }}>
            <div style={{ fontSize: 11, color: B.txtD, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Try asking</div>
            {["Show me all State Farm cases in litigation",
              "Cases with SOL in the next 90 days",
              "Active property cases in Kentucky",
              "All settled cases",
            ].map((hint, i) => (
              <div key={i} onClick={() => { setQuery(hint); }}
                style={{ padding: "6px 0", fontSize: 13, color: B.txtM, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.color = B.gold}
                onMouseLeave={e => e.currentTarget.style.color = B.txtM}>
                → {hint}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {description && (
              <div style={{ padding: "12px 20px", fontSize: 13, color: B.gold, background: `${B.gold}08`, borderBottom: `1px solid ${B.bdr}` }}>
                {description}
              </div>
            )}
            {results.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No results found</div>
            )}
            {results.map(c => {
              const sc = stClr(c.status);
              return (
                <div key={c.id}
                  onClick={() => { onOpenCase(c.id); onClose(); }}
                  style={{ padding: "12px 20px", cursor: "pointer", borderBottom: `1px solid ${B.bdr}06`, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.client}</div>
                    <div style={{ fontSize: 11, color: B.txtD }}>
                      <span style={{ ...S.mono, color: B.gold }}>{c.ref}</span>
                      {" · "}{c.insurer} · {c.jurisdiction}
                      {c.attorney && ` · ${c.attorney}`}
                    </div>
                  </div>
                  <span style={{ ...S.badge, background: sc.bg, color: sc.t }}>{c.status}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${B.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: B.txtD }}>
            <kbd style={{ background: B.bdr, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>Enter</kbd> to search
            {" · "}
            <kbd style={{ background: B.bdr, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>Esc</kbd> to close
          </span>
          <span style={{ fontSize: 11, color: B.txtD }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AI CASE SUMMARY PANEL
// ═══════════════════════════════════════════════════════════
function AiSummaryPanel({ caseId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action: "summarize" }),
      });
      const data = await resp.json();
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Failed to load AI summary:", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadSummary(); }, [caseId]);

  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)}
        style={{ ...S.card, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: B.gold }}>AI Case Summary</span>
        <span style={{ fontSize: 11, color: B.txtD, marginLeft: "auto" }}>Click to expand</span>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginBottom: 16, borderColor: `${B.gold}30` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: B.gold }}>AI Case Summary</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadSummary} disabled={loading} style={{ ...S.btnO, fontSize: 11, padding: "4px 10px" }}>
            {loading ? "⏳ Loading..." : "🔄 Refresh"}
          </button>
          <button onClick={() => setExpanded(false)} style={{ ...S.btnO, fontSize: 11, padding: "4px 10px" }}>Collapse</button>
        </div>
      </div>

      {loading && !summary && (
        <div style={{ padding: 20, textAlign: "center", color: B.txtM }}>Analyzing case data...</div>
      )}

      {summary && (
        <div>
          {/* Risks */}
          {summary.risks && summary.risks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: B.danger, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>⚠️ Risks Identified</div>
              {summary.risks.map((r, i) => (
                <div key={i} style={{
                  padding: "8px 12px", marginBottom: 4, borderRadius: 6,
                  background: r.severity === "critical" ? B.dangerBg : B.goldBg,
                  border: `1px solid ${r.severity === "critical" ? B.danger : B.gold}30`,
                  fontSize: 12, color: r.severity === "critical" ? B.danger : B.gold,
                }}>
                  {r.message}
                </div>
              ))}
            </div>
          )}

          {/* Key Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { l: "SOL", v: summary.solDays != null ? `${summary.solDays}d` : "—", c: summary.solDays < 30 ? B.danger : summary.solDays < 90 ? B.gold : B.green },
              { l: "Last Activity", v: summary.daysSinceActivity != null ? `${summary.daysSinceActivity}d ago` : "—", c: summary.daysSinceActivity > 60 ? B.danger : B.txtM },
              { l: "Negotiations", v: summary.negotiationCount, c: "#5b8def" },
            ].map((x, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#0a0a14", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5 }}>{x.l}</div>
                <div style={{ ...S.mono, fontSize: 16, fontWeight: 700, color: x.c }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          {(summary.lastDemand || summary.lastOffer || summary.highestEstimate > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>💰 Financial Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {summary.highestEstimate > 0 && (
                  <div style={{ fontSize: 12, color: B.txtM }}>Highest Estimate: <span style={{ ...S.mono, color: B.green, fontWeight: 600 }}>{fmt(summary.highestEstimate)}</span></div>
                )}
                {summary.lastDemand && (
                  <div style={{ fontSize: 12, color: B.txtM }}>Last Demand: <span style={{ ...S.mono, color: B.gold, fontWeight: 600 }}>{fmt(summary.lastDemand.amount)}</span></div>
                )}
                {summary.lastOffer && (
                  <div style={{ fontSize: 12, color: B.txtM }}>Last Offer: <span style={{ ...S.mono, color: "#5b8def", fontWeight: 600 }}>{fmt(summary.lastOffer.amount)}</span></div>
                )}
                {summary.totalRecovery > 0 && (
                  <div style={{ fontSize: 12, color: B.txtM }}>Total Recovery: <span style={{ ...S.mono, color: B.green, fontWeight: 600 }}>{fmt(summary.totalRecovery)}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {summary.nextSteps && summary.nextSteps.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: B.green, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>📋 Suggested Next Steps</div>
              {summary.nextSteps.map((step, i) => (
                <div key={i} style={{ padding: "6px 0", fontSize: 12, color: B.txt, display: "flex", gap: 8 }}>
                  <span style={{ color: B.green }}>→</span> {step}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DOCUMENT BROWSER (Clio / OneDrive)
// ═══════════════════════════════════════════════════════════
function DocumentBrowser({ clientName }) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(clientName || null);
  const [cases, setCasesLocal] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDocs = async (params) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams(params).toString();
      const resp = await fetch(`/api/docs?${qs}`);
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
        return null;
      }
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const data = await fetchDocs({});
      if (data) setClients(data.clients || []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    (async () => {
      const data = await fetchDocs({ client: selectedClient });
      if (data) setCasesLocal(data.cases || []);
    })();
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClient || !selectedCase) return;
    (async () => {
      const data = await fetchDocs({ client: selectedClient, case: selectedCase });
      if (data) setCategories(data.categories || []);
    })();
  }, [selectedClient, selectedCase]);

  useEffect(() => {
    if (!selectedClient || !selectedCase || !selectedCategory) return;
    (async () => {
      const data = await fetchDocs({ client: selectedClient, case: selectedCase, category: selectedCategory });
      if (data) setFiles(data.files || []);
    })();
  }, [selectedClient, selectedCase, selectedCategory]);

  const fileIcon = ext => {
    if ([".pdf"].includes(ext)) return "📕";
    if ([".doc", ".docx"].includes(ext)) return "📘";
    if ([".xls", ".xlsx"].includes(ext)) return "📗";
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff"].includes(ext)) return "🖼️";
    if ([".msg", ".eml"].includes(ext)) return "📧";
    return "📄";
  };

  const Breadcrumb = () => (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 16, fontSize: 12, color: B.txtM, flexWrap: "wrap" }}>
      <span onClick={() => { setSelectedClient(null); setSelectedCase(null); setSelectedCategory(null); setFiles([]); }}
        style={{ cursor: "pointer", color: B.gold }}>📁 Clio</span>
      {selectedClient && <>
        <span style={{ color: B.txtD }}>/</span>
        <span onClick={() => { setSelectedCase(null); setSelectedCategory(null); setFiles([]); }}
          style={{ cursor: "pointer", color: B.gold }}>{selectedClient}</span>
      </>}
      {selectedCase && <>
        <span style={{ color: B.txtD }}>/</span>
        <span onClick={() => { setSelectedCategory(null); setFiles([]); }}
          style={{ cursor: "pointer", color: B.gold }}>{selectedCase}</span>
      </>}
      {selectedCategory && <>
        <span style={{ color: B.txtD }}>/</span>
        <span style={{ color: B.txt }}>{selectedCategory}</span>
      </>}
    </div>
  );

  if (error === "Path not found") {
    return (
      <div style={S.card}>
        <Breadcrumb />
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, color: B.txtM }}>Clio folder not found on this machine.</div>
          <div style={{ fontSize: 12, color: B.txtD, marginTop: 8 }}>Documents are available when running locally with OneDrive synced.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb />
      {loading && <div style={{ padding: 20, textAlign: "center", color: B.txtM }}>Loading...</div>}

      {/* Client list */}
      {!selectedClient && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {clients.map(c => (
            <div key={c} onClick={() => setSelectedClient(c)}
              style={{ ...S.card, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = B.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = B.bdr}>
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{c}</span>
            </div>
          ))}
          {clients.length === 0 && !error && (
            <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: B.txtD }}>No clients found</div>
          )}
        </div>
      )}

      {/* Case list */}
      {selectedClient && !selectedCase && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {cases.map(c => (
            <div key={c} onClick={() => setSelectedCase(c)}
              style={{ ...S.card, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = B.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = B.bdr}>
              <span style={{ fontSize: 16 }}>📁</span>
              <span style={{ fontSize: 13, fontWeight: 500, ...S.mono }}>{c}</span>
            </div>
          ))}
          {cases.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: B.txtD }}>No case folders found</div>}
        </div>
      )}

      {/* Category list */}
      {selectedCase && !selectedCategory && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {categories.map(c => (
            <div key={c} onClick={() => setSelectedCategory(c)}
              style={{ ...S.card, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = B.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = B.bdr}>
              <span style={{ fontSize: 16 }}>📂</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{c}</span>
            </div>
          ))}
          {categories.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: B.txtD }}>No categories found</div>}
        </div>
      )}

      {/* File list */}
      {selectedCategory && !loading && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          {files.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No files in this category</div>
          ) : (
            <table style={S.tbl}>
              <thead><tr>
                <th style={S.th}>File</th>
                <th style={S.th}>Size</th>
                <th style={S.th}>Modified</th>
              </tr></thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{fileIcon(f.ext)}</span>
                      <span style={{ fontSize: 13 }}>{f.name}</span>
                    </td>
                    <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.txtM }}>{fmtSize(f.size)}</td>
                    <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.txtM }}>{f.modified ? fmtD(f.modified.split("T")[0]) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {error && error !== "Path not found" && (
        <div style={{ padding: 12, background: B.dangerBg, borderRadius: 6, fontSize: 12, color: B.danger, marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════
function Login({ onLogin, team }) {
  const [e, setE] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!e || !p) { setErr("Enter email and password"); return; }
    setLoading(true); setErr("");
    try {
      const { user: authUser } = await api.signIn(e, p);
      const member = team.find(m => m.email?.toLowerCase() === e.toLowerCase())
        || team.find(m => m.name.toLowerCase().includes(e.split("@")[0].toLowerCase()));
      if (member) onLogin(member);
      else onLogin({ id: authUser.id, name: authUser.user_metadata?.name || e.split("@")[0], role: "Staff", title: "Staff", ini: e.substring(0, 2).toUpperCase(), clr: "#888" });
    } catch (ex) { setErr(ex.message || "Sign in failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at 30% 20%,${B.navyBg} 0%,${B.bg} 70%)` }}>
      <div style={{ width: 380, ...S.card, padding: 40, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg,${B.navy},${B.gold})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22, fontWeight: 800, color: "#fff" }}>D</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>DENHAM LAW</h1>
        <p style={{ fontSize: 13, color: B.txtM, marginBottom: 28 }}>Staff Portal</p>
        <div style={{ marginBottom: 12 }}><input placeholder="Email" value={e} onChange={x => setE(x.target.value)} style={S.input} onKeyDown={x => x.key === "Enter" && handleSignIn()} /></div>
        <div style={{ marginBottom: 20 }}><input placeholder="Password" type="password" value={p} onChange={x => setP(x.target.value)} style={S.input} onKeyDown={x => x.key === "Enter" && handleSignIn()} /></div>
        {err && <p style={{ fontSize: 12, color: "#e05050", marginBottom: 12 }}>{err}</p>}
        <button onClick={handleSignIn} disabled={loading} style={{ ...S.btn, width: "100%", padding: "10px 0", opacity: loading ? 0.6 : 1 }}>{loading ? "Signing in..." : "Sign In"}</button>
        <p style={{ fontSize: 11, color: B.txtD, marginTop: 24, marginBottom: 12 }}>Demo — click to login as:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {team.slice(0, 8).map(t => (
            <button key={t.id} onClick={() => onLogin(t)} style={{ background: `${t.clr}15`, border: `1px solid ${t.clr}30`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: t.clr, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
              {t.name.split(" ")[0]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: B.txtD, marginTop: 28 }}>859-900-BART · denham.law</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════
function Side({ user, active, onNav, onOut }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "⬡" },
    { id: "cases", label: "My Cases", icon: "◈" },
    { id: "tasks", label: "Tasks", icon: "☐" },
    { id: "docs", label: "Documents", icon: "◇" },
  ];

  return (
    <div style={{ width: 220, minHeight: "100vh", background: B.card, borderRight: `1px solid ${B.bdr}`, display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100 }}>
      <div style={{ padding: "20px 16px", borderBottom: `1px solid ${B.bdr}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg,${B.navy},${B.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>D</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>DENHAM CMS</div>
            <div style={{ fontSize: 10, color: B.txtD }}>v3.0 · AI</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 8px", flex: 1 }}>
        {nav.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px",
            borderRadius: 8, border: "none", background: active === n.id ? `${B.gold}15` : "transparent",
            color: active === n.id ? B.gold : B.txtM, cursor: "pointer", fontSize: 13,
            fontWeight: active === n.id ? 600 : 400, fontFamily: "'DM Sans',sans-serif", marginBottom: 2, textAlign: "left",
          }}>
            <span style={{ fontSize: 16, opacity: 0.7 }}>{n.icon}</span>{n.label}
          </button>
        ))}
        {/* Cmd+K hint */}
        <div style={{ padding: "12px 12px 0", marginTop: 8, borderTop: `1px solid ${B.bdr}` }}>
          <div style={{ fontSize: 11, color: B.txtD, display: "flex", alignItems: "center", gap: 6 }}>
            <kbd style={{ background: B.bdr, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>⌘K</kbd>
            <span>AI Command Bar</span>
          </div>
        </div>
      </div>
      <div style={{ padding: 16, borderTop: `1px solid ${B.bdr}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: user.clr, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{user.ini}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{user.name.split(" ")[0]}</div>
            <div style={{ fontSize: 10, color: B.txtD }}>{user.title}</div>
          </div>
        </div>
        <button onClick={onOut} style={{ ...S.btnO, width: "100%", fontSize: 11, padding: "6px 0" }}>Sign Out</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
function Dash({ user, cases, onOpen, onFilterStatus }) {
  const my = cases.filter(c => c.attorney?.id === user.id || c.support?.id === user.id);
  const ac = my.filter(c => c.status !== "Settled" && c.status !== "Closed");
  const sol90 = ac.filter(c => c.sol && dU(c.sol) < 90);
  const rec = my.reduce((s, c) => s + c.totalRec, 0);
  const sc = {};
  ac.forEach(c => { sc[c.status] = (sc[c.status] || 0) + 1; });

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Welcome back, {user.name.split(" ")[0]}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { l: "Active Cases", v: ac.length, c: B.gold },
          { l: "Total Recoveries", v: fmt(rec), c: B.green },
          { l: "SOL < 90 Days", v: sol90.length, c: sol90.length > 0 ? B.danger : B.txtD },
          { l: "My Cases Total", v: my.length, c: "#5b8def" },
        ].map((x, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 11, color: B.txtM, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{x.l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: x.c, ...S.mono }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <h3 style={S.secT}>Cases by Status</h3>
          {Object.entries(sc).sort((a, b) => b[1] - a[1]).map(([st, ct]) => {
            const c = stClr(st);
            return (
              <div key={st} onClick={() => onFilterStatus(st)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", borderBottom: `1px solid ${B.bdr}06`, cursor: "pointer", borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ ...S.badge, background: c.bg, color: c.t }}>{st}</span>
                <span style={{ ...S.mono, fontSize: 14, fontWeight: 600, color: c.t }}>{ct}</span>
              </div>
            );
          })}
        </div>
        <div style={S.card}>
          <h3 style={S.secT}>Upcoming SOL Deadlines</h3>
          {ac.filter(c => c.sol).sort((a, b) => new Date(a.sol) - new Date(b.sol)).slice(0, 6).map(c => {
            const d = dU(c.sol);
            return (
              <div key={c.id} onClick={() => onOpen(c)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${B.bdr}06`, cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.client}</div>
                  <div style={{ fontSize: 11, color: B.txtD }}>{c.ref}</div>
                </div>
                <span style={{ ...S.mono, fontSize: 12, fontWeight: 600, color: d < 30 ? B.danger : d < 90 ? B.gold : B.txtM }}>{d}d</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CASES LIST (with smart search)
// ═══════════════════════════════════════════════════════════
function Cases({ user, cases, onOpen, initialStatus, onClearFilter }) {
  const [search, setSearch] = useState("");
  const [fSt, setFSt] = useState(initialStatus || "All");
  const [fJ, setFJ] = useState("All");
  const [sBy, setSBy] = useState("dop");
  const [sDir, setSDir] = useState("desc");
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const searchTimeout = useRef(null);

  // Smart search: detect natural language and use AI endpoint
  const handleSearch = (val) => {
    setSearch(val);
    setAiResults(null);

    // Heuristic: if search looks like natural language (>3 words or contains keywords), use AI
    const words = val.trim().split(/\s+/);
    const nlKeywords = ["show", "find", "get", "list", "all", "with", "in", "cases", "where", "who", "what"];
    const isNL = words.length > 3 || words.some(w => nlKeywords.includes(w.toLowerCase()));

    if (isNL && val.trim().length > 10) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(async () => {
        setAiLoading(true);
        try {
          const resp = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: val, action: "search" }),
          });
          const data = await resp.json();
          if (data.cases) setAiResults(data);
        } catch { /* ignore */ }
        setAiLoading(false);
      }, 500);
    }
  };

  const my = cases.filter(c => c.attorney?.id === user.id || c.support?.id === user.id);
  const fl = my.filter(c => {
    if (search && !aiResults) {
      const q = search.toLowerCase();
      if (!c.client?.toLowerCase().includes(q) && !c.ref?.toLowerCase().includes(q) && !c.insurer?.toLowerCase().includes(q)) return false;
    }
    if (fSt !== "All" && c.status !== fSt) return false;
    if (fJ !== "All" && c.juris !== fJ) return false;
    return true;
  }).sort((a, b) => {
    let va = a[sBy] || "", vb = b[sBy] || "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sDir === "asc" ? -1 : 1;
    if (va > vb) return sDir === "asc" ? 1 : -1;
    return 0;
  });

  // If AI returned results, show those instead
  const displayCases = aiResults ? aiResults.cases : fl;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        My Cases <span style={{ fontSize: 14, color: B.txtD, fontWeight: 400 }}>({displayCases.length})</span>
      </h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", maxWidth: 400, flex: 1 }}>
          <input
            placeholder="Search or ask in natural language..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={S.input}
          />
          {aiLoading && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: B.gold }}>🔍</span>}
        </div>
        <select value={fSt} onChange={e => setFSt(e.target.value)} style={{ ...S.input, width: 180 }}>
          <option value="All">All Statuses</option>
          {CSTATS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={fJ} onChange={e => setFJ(e.target.value)} style={{ ...S.input, width: 100 }}>
          <option value="All">All States</option>
          {JURIS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      {aiResults && (
        <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 6, background: `${B.gold}08`, border: `1px solid ${B.gold}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: B.gold }}>🤖 {aiResults.description}</span>
          <button onClick={() => { setAiResults(null); setSearch(""); }} style={{ ...S.btnO, fontSize: 11, padding: "2px 8px" }}>Clear</button>
        </div>
      )}

      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={S.tbl}>
          <thead><tr>
            {[["ref", "Case #"], ["client", "Client"], ["type", "Type"], ["status", "Status"], ["juris", "State"], ["insurer", "Insurer"], ["dop", "Opened"], ["sol", "SOL"]].map(([c, l]) => (
              <th key={c} onClick={() => { if (sBy === c) setSDir(d => d === "asc" ? "desc" : "asc"); else { setSBy(c); setSDir("desc"); } }} style={{ ...S.th, cursor: "pointer" }}>
                {l}{sBy === c ? (sDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {(aiResults ? displayCases : fl.slice(0, 50)).map(c => {
              const sc = stClr(c.status);
              const sd = c.sol ? dU(c.sol) : null;
              return (
                <tr key={c.id} onClick={() => onOpen(aiResults ? { id: c.id } : c)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.gold, fontWeight: 500 }}>{c.ref}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{c.client}</td>
                  <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{c.type}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: sc.bg, color: sc.t }}>{c.status}</span></td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{c.juris || c.jurisdiction}</td>
                  <td style={{ ...S.td, fontSize: 12 }}>{c.insurer}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.txtM }}>{fmtD(c.dop || c.dateOfLoss)}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, fontWeight: 600, color: sd != null ? (sd < 30 ? B.danger : sd < 90 ? B.gold : B.txtM) : B.txtD }}>{c.sol ? fmtD(c.sol) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ACTIVITY FEED
// ═══════════════════════════════════════════════════════════
function ActivityFeed({ c }) {
  const [ft, setFt] = useState("all");
  const [sd, setSd] = useState("desc");
  const acts = (c.acts || []).filter(a => ft === "all" || a.type === ft)
    .sort((a, b) => sd === "desc" ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <select value={ft} onChange={e => setFt(e.target.value)} style={{ ...S.input, width: 180 }}>
          <option value="all">All Activity</option>
          {ATYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
        </select>
        <button onClick={() => setSd(d => d === "desc" ? "asc" : "desc")} style={S.btnO}>
          {sd === "desc" ? "Newest First ↓" : "Oldest First ↑"}
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: B.txtD }}>{acts.length} entries</div>
      </div>
      <div style={{ ...S.card, padding: 0 }}>
        {acts.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No activity matching filter</div> :
          acts.map((a, i) => (
            <div key={a.id || i} style={{ display: "flex", gap: 14, padding: "14px 20px", borderBottom: i < acts.length - 1 ? `1px solid ${B.bdr}06` : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: a.aClr || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{a.aIni || "?"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.actor}</span>
                  <span style={{ fontSize: 12 }}>{aIcon(a.type)}</span>
                  <span style={{ fontSize: 12, color: B.txtM }}>{a.title}</span>
                  <span style={{ marginLeft: "auto", ...S.mono, fontSize: 11, color: B.txtD }}>{fmtD(a.date)} {a.time}</span>
                </div>
                {a.desc && <div style={{ fontSize: 12, color: B.txtD }}>{a.desc}</div>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CLAIM DETAILS
// ═══════════════════════════════════════════════════════════
function ClaimDetails({ c }) {
  const d = c.cd || {};
  const F = ({ l, v, m, clr, href }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>{l}</div>
      {href ? <a href={href} style={{ fontSize: m ? 13 : 14, fontWeight: 500, color: clr || B.gold, ...(m ? S.mono : {}), textDecoration: "none" }}>{v || "—"}</a>
        : <div style={{ fontSize: m ? 13 : 14, fontWeight: 500, color: clr || B.txt, ...(m ? S.mono : {}) }}>{v || "—"}</div>}
    </div>
  );
  const telHref = p => p ? `tel:${p.replace(/[^0-9+]/g, "")}` : "";
  const mailHref = e => e ? `mailto:${e}` : "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={S.card}><h3 style={{ ...S.secT, marginBottom: 20 }}>Policy Information</h3>
        <F l="Policy Number" v={d.policyNumber} m /><F l="Claim Number" v={d.claimNumber} m />
        <F l="Insurance Company" v={d.insurer} /><F l="Policy Type" v={d.policyType} />
        <F l="Policy Limits" v={d.policyLimits} m clr={B.gold} /><F l="Deductible" v={d.deductible} m />
      </div>
      <div style={S.card}><h3 style={{ ...S.secT, marginBottom: 20 }}>Claim Information</h3>
        <F l="Date of Loss" v={fmtD(d.dateOfLoss)} m /><F l="Date Reported" v={fmtD(d.dateReported)} m />
        <F l="Date Denied" v={d.dateDenied ? fmtD(d.dateDenied) : "Not denied"} m clr={d.dateDenied ? B.danger : B.green} />
        <F l="Cause of Loss" v={d.causeOfLoss} />{d.propAddr && <F l="Property Address" v={d.propAddr} />}
      </div>
      <div style={{ ...S.card, gridColumn: "1/-1" }}><h3 style={{ ...S.secT, marginBottom: 20 }}>Adjuster Contact</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <F l="Name" v={d.adjuster} /><F l="Phone" v={d.adjPhone} m href={telHref(d.adjPhone)} /><F l="Email" v={d.adjEmail} m href={mailHref(d.adjEmail)} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LITIGATION DETAILS
// ═══════════════════════════════════════════════════════════
function LitDetails({ c }) {
  const l = c.ld;
  const F = ({ l: lb, v, m, clr, href }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>{lb}</div>
      {href ? <a href={href} style={{ fontSize: m ? 13 : 14, fontWeight: 500, color: clr || B.gold, ...(m ? S.mono : {}), textDecoration: "none" }}>{v || "—"}</a>
        : <div style={{ fontSize: m ? 13 : 14, fontWeight: 500, color: clr || B.txt, ...(m ? S.mono : {}) }}>{v || "—"}</div>}
    </div>
  );
  const telHref = p => p ? `tel:${p.replace(/[^0-9+]/g, "")}` : "";
  const mailHref = e => e ? `mailto:${e}` : "";

  if (!l) return (
    <div style={{ ...S.card, padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Not in Litigation</div>
      <div style={{ fontSize: 13, color: B.txtM }}>Litigation details will appear here once a complaint is filed.</div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={S.card}><h3 style={{ ...S.secT, marginBottom: 20 }}>Court Information</h3>
        <F l="Case Number" v={l.caseNum} m /><F l="Court" v={l.court} /><F l="Judge" v={l.judge} /><F l="Filed Date" v={fmtD(l.filedDate)} m />
      </div>
      <div style={S.card}><h3 style={{ ...S.secT, marginBottom: 20 }}>Opposing Counsel</h3>
        <F l="Attorney" v={l.oppCounsel} /><F l="Firm" v={l.oppFirm} />
        <F l="Phone" v={l.oppPhone} m href={telHref(l.oppPhone)} /><F l="Email" v={l.oppEmail} m href={mailHref(l.oppEmail)} />
      </div>
      <div style={{ ...S.card, gridColumn: "1/-1" }}><h3 style={{ ...S.secT, marginBottom: 20 }}>Key Dates</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div><F l="Trial Date" v={l.trialDate ? fmtD(l.trialDate) : "Not set"} m clr={l.trialDate ? B.danger : B.txtD} />
            {l.trialDate && <div style={{ ...S.mono, fontSize: 11, color: dU(l.trialDate) < 60 ? B.danger : B.gold }}>{dU(l.trialDate)} days away</div>}</div>
          <div><F l="Mediation Date" v={l.medDate ? fmtD(l.medDate) : "Not set"} m clr={l.medDate ? B.purple : B.txtD} />
            {l.medDate && <div style={{ ...S.mono, fontSize: 11, color: B.purple }}>{dU(l.medDate)} days away</div>}</div>
          <F l="Discovery Deadline" v={fmtD(l.discDeadline)} m clr="#5b8def" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NEGOTIATIONS
// ═══════════════════════════════════════════════════════════
function Negotiations({ c }) {
  const [sd, setSd] = useState("desc");
  const negs = [...(c.negs || [])].sort((a, b) => sd === "desc" ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));

  const find = type => (c.negs || []).filter(n => n.type === type).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const bl = find("bottom_line"), lp = find("plaintiff_offer"), ld = find("defendant_offer");
  const sett = find("settlement"), den = find("denial"), apr = find("appraisal_award");
  const psd = find("presuit_demand"), und = find("undisputed_payment");

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Bottom Line", v: bl ? fmt(bl.amount) : "—", c: B.gold },
          { l: "Last Plaintiff Offer", v: lp ? fmt(lp.amount) : "—", c: B.green },
          { l: "Last Defendant Offer", v: ld ? fmt(ld.amount) : "—", c: "#5b8def" },
          { l: "Presuit Demand", v: psd ? fmt(psd.amount) : "—", c: "#e0a050" },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 18, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Settlement", v: sett ? fmt(sett.amount) : "—", c: "#50c878" },
          { l: "Undisputed Payment", v: und ? fmt(und.amount) : "—", c: "#7eb87e" },
          { l: "Denial", v: den ? "DENIED" : "—", c: den ? B.danger : B.txtD },
          { l: "Appraisal Award", v: apr ? fmt(apr.amount) : "—", c: B.purple },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 18, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Negotiation spread chart */}
      {(c.negs || []).filter(n => n.amount > 0).length > 0 && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <h3 style={{ ...S.secT, marginBottom: 16 }}>Negotiation Spread</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...(c.negs || [])].filter(n => n.amount > 0).sort((a, b) => b.amount - a.amount).map((n, i) => {
              const mx = Math.max(...(c.negs || []).filter(x => x.amount > 0).map(x => x.amount));
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 120, fontSize: 11, color: B.txtM, textAlign: "right", flexShrink: 0 }}>{nLbl(n.type)}</div>
                  <div style={{ flex: 1, height: 24, background: `${B.bdr}40`, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n.amount / mx) * 100}%`, background: `${nClr(n.type)}22`, borderRadius: 4, borderRight: `3px solid ${nClr(n.type)}` }} />
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: nClr(n.type), ...S.mono }}>{fmt(n.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={S.secT}>Negotiation History</h3>
        <button onClick={() => setSd(d => d === "desc" ? "asc" : "desc")} style={S.btnO}>{sd === "desc" ? "Newest ↓" : "Oldest ↑"}</button>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {negs.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No negotiation events</div> :
          <table style={S.tbl}><thead><tr>
            <th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Amount</th><th style={S.th}>Notes</th><th style={S.th}>By</th>
          </tr></thead><tbody>
            {negs.map((n, i) => (
              <tr key={i}>
                <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{fmtD(n.date)}</td>
                <td style={S.td}><span style={{ ...S.badge, background: `${nClr(n.type)}18`, color: nClr(n.type) }}>{nLbl(n.type)}</span></td>
                <td style={{ ...S.td, ...S.mono, fontSize: 13, fontWeight: 600, color: nClr(n.type) }}>{n.type === "denial" ? "—" : fmt(n.amount)}</td>
                <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{n.notes}</td>
                <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{n.by}</td>
              </tr>
            ))}
          </tbody></table>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ESTIMATES
// ═══════════════════════════════════════════════════════════
function Estimates({ c }) {
  const ests = [...(c.ests || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const hi = ests.length > 0 ? Math.max(...ests.map(e => e.amount)) : 0;
  const lo = ests.length > 0 ? Math.min(...ests.map(e => e.amount)) : 0;
  const av = ests.length > 0 ? Math.round(ests.reduce((s, e) => s + e.amount, 0) / ests.length) : 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Highest Estimate", v: hi > 0 ? fmt(hi) : "—", c: B.green },
          { l: "Lowest Estimate", v: lo > 0 ? fmt(lo) : "—", c: B.danger },
          { l: "Average Estimate", v: av > 0 ? fmt(av) : "—", c: B.gold },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 20, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {ests.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No estimates recorded</div> :
          <table style={S.tbl}><thead><tr>
            <th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Vendor</th><th style={S.th}>Amount</th><th style={S.th}>Notes</th>
          </tr></thead><tbody>
            {ests.map((e, i) => (
              <tr key={i}>
                <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{fmtD(e.date)}</td>
                <td style={S.td}><span style={{ ...S.badge, background: B.goldBg, color: B.gold }}>{e.type}</span></td>
                <td style={{ ...S.td, fontSize: 13 }}>{e.vendor}</td>
                <td style={{ ...S.td, ...S.mono, fontSize: 14, fontWeight: 600, color: B.green }}>{fmt(e.amount)}</td>
                <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{e.notes}</td>
              </tr>
            ))}
          </tbody></table>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PLEADINGS
// ═══════════════════════════════════════════════════════════
function Pleadings({ c }) {
  const pl = [...(c.pleads || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const byP = pl.filter(p => p.filedBy === "Plaintiff").length;
  const byD = pl.filter(p => p.filedBy === "Defendant").length;

  if (pl.length === 0) return (
    <div style={{ ...S.card, padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Pleadings</div>
      <div style={{ fontSize: 13, color: B.txtM }}>Pleadings will appear here once the case enters litigation.</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Total Pleadings", v: pl.length, c: B.purple },
          { l: "By Plaintiff", v: byP, c: B.green },
          { l: "By Defendant", v: byD, c: "#5b8def" },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 20, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={S.tbl}><thead><tr>
          <th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Filed By</th><th style={S.th}>Status</th><th style={S.th}>Notes</th><th style={S.th}>Doc</th>
        </tr></thead><tbody>
          {pl.map((p, i) => (
            <tr key={i}>
              <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{fmtD(p.date)}</td>
              <td style={{ ...S.td, fontSize: 13, fontWeight: 500 }}>{p.type}</td>
              <td style={S.td}><span style={{ ...S.badge, background: p.filedBy === "Plaintiff" ? B.greenBg : "rgba(91,141,239,0.12)", color: p.filedBy === "Plaintiff" ? B.green : "#5b8def" }}>{p.filedBy}</span></td>
              <td style={S.td}><span style={{ ...S.badge, background: p.status === "Granted" ? B.greenBg : p.status === "Denied" ? B.dangerBg : B.goldBg, color: p.status === "Granted" ? B.green : p.status === "Denied" ? B.danger : B.gold }}>{p.status}</span></td>
              <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{p.notes || "—"}</td>
              <td style={S.td}>{p.docUrl ? <span style={{ fontSize: 12, color: B.gold, cursor: "pointer" }}>📎 View</span> : <span style={{ fontSize: 12, color: B.txtD }}>—</span>}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CASE DETAIL
// ═══════════════════════════════════════════════════════════
function CaseDetail({ c, onBack, onUpdate }) {
  const [tab, setTab] = useState("activity");
  const tabs = [
    { id: "activity", l: "Activity Feed" }, { id: "claim", l: "Claim Details" },
    { id: "litigation", l: "Litigation" }, { id: "negotiations", l: "Negotiations" },
    { id: "estimates", l: "Estimates" }, { id: "pleadings", l: "Pleadings" },
    { id: "docs", l: "Documents" },
  ];
  const sc = stClr(c.status);
  const sd = c.sol ? dU(c.sol) : null;

  const changeStatus = (newSt) => { if (onUpdate) onUpdate(c.id, { status: newSt }); };

  return (
    <div>
      {/* AI Summary Panel */}
      <AiSummaryPanel caseId={c.id} />

      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...S.btnO, marginBottom: 16, fontSize: 12 }}>← Back to Cases</button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{c.client}</h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ ...S.mono, fontSize: 13, color: B.gold }}>{c.ref}</span>
              <select value={c.status} onChange={e => changeStatus(e.target.value)}
                style={{ background: sc.bg, color: sc.t, border: `1px solid ${sc.t}40`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", outline: "none", appearance: "auto" }}>
                {CSTATS.map(st => <option key={st} value={st} style={{ background: B.card, color: B.txt }}>{st}</option>)}
              </select>
              <span style={{ fontSize: 12, color: B.txtM }}>{c.type}</span>
              <span style={{ ...S.mono, fontSize: 12, color: B.txtM }}>{c.juris}</span>
              <span style={{ fontSize: 12, color: B.txtM }}>v. {c.insurer}</span>
            </div>
          </div>
          {sd != null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 2 }}>SOL</div>
              <div style={{ ...S.mono, fontSize: 16, fontWeight: 700, color: sd < 30 ? B.danger : sd < 90 ? B.gold : B.green }}>{fmtD(c.sol)}</div>
              <div style={{ ...S.mono, fontSize: 11, color: sd < 30 ? B.danger : sd < 90 ? B.gold : B.txtD }}>{sd} days</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Attorney", v: c.attorney?.name?.split(" ")[0] || "—", c: c.attorney?.clr || "#888" },
          { l: "Support", v: c.support?.name?.split(" ")[0] || "—", c: c.support?.clr || "#888" },
          { l: "Date of Loss", v: fmtD(c.dol), c: B.txtM },
          { l: "Negotiations", v: (c.negs || []).length, c: "#5b8def" },
          { l: "Recovery", v: c.totalRec > 0 ? fmt(c.totalRec) : "—", c: c.totalRec > 0 ? B.green : B.txtD },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${B.bdr}`, paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 16px", border: "none",
            borderBottom: tab === t.id ? `2px solid ${B.gold}` : "2px solid transparent",
            background: "transparent", color: tab === t.id ? B.gold : B.txtM,
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", marginBottom: -1,
          }}>
            {t.l}
            {t.id === "negotiations" && (c.negs || []).length > 0 && <span style={{ marginLeft: 6, ...S.mono, fontSize: 10, background: `${B.gold}20`, color: B.gold, padding: "1px 6px", borderRadius: 10 }}>{(c.negs || []).length}</span>}
            {t.id === "pleadings" && (c.pleads || []).length > 0 && <span style={{ marginLeft: 6, ...S.mono, fontSize: 10, background: `${B.purple}20`, color: B.purple, padding: "1px 6px", borderRadius: 10 }}>{(c.pleads || []).length}</span>}
          </button>
        ))}
      </div>

      {tab === "activity" && <ActivityFeed c={c} />}
      {tab === "claim" && <ClaimDetails c={c} />}
      {tab === "litigation" && <LitDetails c={c} />}
      {tab === "negotiations" && <Negotiations c={c} />}
      {tab === "estimates" && <Estimates c={c} />}
      {tab === "pleadings" && <Pleadings c={c} />}
      {tab === "docs" && <DocumentBrowser clientName={c.client} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PORTAL
// ═══════════════════════════════════════════════════════════
export default function DenhamStaffPortal() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [selCase, setSelCase] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [cases, setCases] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cmdBarOpen, setCmdBarOpen] = useState(false);

  // Cmd+K handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdBarOpen(prev => !prev);
      }
      if (e.key === "Escape") setCmdBarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load team members from Supabase
  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured. Please check your environment variables.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const members = await api.listTeamMembers();
        if (members && members.length > 0) {
          setTeam(members.map(m => ({
            id: m.id, name: m.name, role: m.role, title: m.title,
            ini: m.initials, clr: m.color || "#888", email: m.email,
          })));
        }
      } catch (e) {
        console.warn("Failed to load team from Supabase:", e);
      }
    })();
  }, []);

  // Load cases from Supabase ONLY
  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listCases();
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setCases(rows.map(sbToCase));
        } else {
          setError("No cases found in database. The Supabase database may be empty.");
        }
      } catch (e) {
        console.error("Failed to load cases from Supabase:", e);
        if (!cancelled) setError("Failed to connect to Supabase: " + e.message);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const updateCase = useCallback(async (id, updates) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (selCase && selCase.id === id) setSelCase(prev => ({ ...prev, ...updates }));
    if (supabase) {
      try {
        const dbUpdates = {};
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.client !== undefined) dbUpdates.client_name = updates.client;
        if (Object.keys(dbUpdates).length > 0) {
          await api.updateCase(id, dbUpdates);
        }
      } catch (e) { console.error("Failed to update case in Supabase:", e); }
    }
  }, [selCase]);

  const openCaseById = useCallback(async (caseId) => {
    // Try to find in loaded cases first
    let c = cases.find(x => x.id === caseId);
    if (c) {
      navTo("caseDetail", c);
      return;
    }
    // If not found (e.g. from AI search), fetch from Supabase
    try {
      const row = await api.getCase(caseId);
      if (row) {
        c = sbToCase(row);
        navTo("caseDetail", c);
      }
    } catch (e) {
      console.error("Failed to load case:", e);
    }
  }, [cases]);

  const navTo = (p, cs, sf) => {
    const state = { page: p, caseId: cs?.id || null, statusFilter: sf || "All" };
    window.history.pushState(state, "", window.location.pathname);
    setPage(p);
    setSelCase(cs || null);
    setStatusFilter(sf || "All");
  };

  useEffect(() => {
    const handler = e => {
      const st = e.state;
      if (st) {
        setPage(st.page || "dashboard");
        setSelCase(st.caseId ? cases.find(c => c.id === st.caseId) || null : null);
        setStatusFilter(st.statusFilter || "All");
      } else {
        setPage("dashboard");
        setSelCase(null);
        setStatusFilter("All");
      }
    };
    window.addEventListener("popstate", handler);
    window.history.replaceState({ page: "dashboard", caseId: null, statusFilter: "All" }, "", window.location.pathname);
    return () => window.removeEventListener("popstate", handler);
  }, [cases]);

  // Error state
  if (error && !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: B.bg }}>
        <div style={{ ...S.card, padding: 40, textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: B.danger }}>Connection Error</h2>
          <p style={{ fontSize: 13, color: B.txtM, lineHeight: 1.6 }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ ...S.btn, marginTop: 20 }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={setUser} team={team} />;

  const openC = c => { navTo("caseDetail", c); };
  const backC = () => { window.history.back(); };
  const filterByStatus = st => { navTo("cases", null, st); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: B.bg }}>
      <Side user={user} active={page === "caseDetail" ? "cases" : page} onNav={p => navTo(p, null, "All")} onOut={() => { setUser(null); if (supabase) api.signOut().catch(() => {}); }} />
      <CommandBar open={cmdBarOpen} onClose={() => setCmdBarOpen(false)} onOpenCase={openCaseById} cases={cases} />
      <div style={{ marginLeft: 220, flex: 1, padding: "28px 32px", maxWidth: 1200 }}>
        {loading && (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: B.txtM }}>Loading cases from Supabase...</div>
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: "12px 16px", background: B.dangerBg, borderRadius: 8, marginBottom: 16, fontSize: 13, color: B.danger }}>
            ⚠️ {error}
          </div>
        )}
        {!loading && page === "dashboard" && <Dash user={user} cases={cases} onOpen={openC} onFilterStatus={filterByStatus} />}
        {!loading && page === "cases" && <Cases user={user} cases={cases} onOpen={openC} initialStatus={statusFilter} onClearFilter={() => setStatusFilter("All")} />}
        {!loading && page === "caseDetail" && selCase && <CaseDetail c={selCase} onUpdate={updateCase} onBack={backC} />}
        {!loading && page === "tasks" && (
          <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Tasks</h2>
            <div style={{ ...S.card, padding: 40, textAlign: "center" }}><div style={{ fontSize: 14, color: B.txtM }}>Global tasks view — coming soon</div></div></div>
        )}
        {!loading && page === "docs" && (
          <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Documents</h2>
            <DocumentBrowser />
          </div>
        )}
      </div>
    </div>
  );
}
