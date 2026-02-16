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

// ─── Loading Skeleton ────────────────────────────────────────
function Skeleton({ width, height, style: extraStyle }) {
  return (
    <div style={{
      width: width || "100%", height: height || 16, borderRadius: 6,
      background: `linear-gradient(90deg, ${B.bdr}40 25%, ${B.bdr}80 50%, ${B.bdr}40 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s ease-in-out infinite",
      ...extraStyle,
    }} />
  );
}

function CaseListSkeleton() {
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <Skeleton width={120} height={32} />
        <Skeleton width={200} height={32} />
        <div style={{ flex: 1 }} />
        <Skeleton width={180} height={16} style={{ alignSelf: "center" }} />
      </div>
      <div style={{ ...S.card, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Skeleton height={36} style={{ flex: 1 }} />
          <Skeleton width={170} height={36} />
          <Skeleton width={150} height={36} />
          <Skeleton width={100} height={36} />
        </div>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ display: "flex", gap: 16, padding: "12px 16px", borderBottom: `1px solid ${B.bdr}06` }}>
            <Skeleton width={16} height={16} />
            <Skeleton width={70} height={14} />
            <Skeleton width={140} height={14} />
            <Skeleton width={100} height={22} style={{ borderRadius: 20 }} />
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={14} />
            <Skeleton width={40} height={14} />
            <Skeleton width={80} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton width={260} height={28} style={{ marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={S.card}>
            <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={60} height={28} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <Skeleton width={140} height={16} style={{ marginBottom: 16 }} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <Skeleton width={120} height={22} style={{ borderRadius: 20 }} />
              <Skeleton width={30} height={16} />
            </div>
          ))}
        </div>
        <div style={S.card}>
          <Skeleton width={180} height={16} style={{ marginBottom: 16 }} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <Skeleton width={150} height={14} />
              <Skeleton width={30} height={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
        <p style={{ fontSize: 10, color: B.txtD, marginTop: 28 }}>859-900-BART · denham.law</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════
function Side({ user, active, onNav, onOut, onCmdK, mobileOpen, onToggleMobile }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "⬡" },
    { id: "cases", label: "Cases", icon: "◈" },
    { id: "tasks", label: "Tasks", icon: "☐" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "docs", label: "Documents", icon: "◇" },
  ];

  return (
    <>
    {/* Mobile overlay */}
    {mobileOpen && <div onClick={onToggleMobile} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 99, display: "none" }}
      className="mobile-overlay" />}
    <div style={{ width: 220, minHeight: "100vh", background: B.card, borderRight: `1px solid ${B.bdr}`, display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100, transition: "transform 0.2s ease", transform: mobileOpen ? "translateX(0)" : undefined }}
      className="sidebar-panel">
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
        {/* Cmd+K hint — clickable */}
        <div style={{ padding: "12px 12px 0", marginTop: 8, borderTop: `1px solid ${B.bdr}` }}>
          <div onClick={onCmdK} style={{ fontSize: 11, color: B.txtD, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 8px", borderRadius: 6, transition: "background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = `${B.gold}15`; e.currentTarget.style.color = B.gold; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = B.txtD; }}>
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
        <button onClick={() => { onOut(); if (onToggleMobile) onToggleMobile(); }} style={{ ...S.btnO, width: "100%", fontSize: 11, padding: "6px 0" }}>Sign Out</button>
      </div>
    </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// SOL REMINDERS PANEL
// ═══════════════════════════════════════════════════════════
function SolRemindersPanel({ onOpen }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/sol-reminders");
        const json = await resp.json();
        setData(json);
      } catch { setData({ critical: [], warning: [], attention: [], total: 0 }); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ ...S.card, padding: 20, textAlign: "center", color: B.txtM }}>Loading SOL reminders...</div>;
  if (!data || data.total === 0) return null;

  const Section = ({ title, items, color, icon }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, color, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span> {title} ({items.length})
      </div>
      {items.map(c => (
        <div key={c.id} onClick={() => onOpen({ id: c.id })}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", marginBottom: 4, borderRadius: 6, cursor: "pointer", background: `${color}08`, border: `1px solid ${color}20` }}
          onMouseEnter={e => e.currentTarget.style.background = `${color}15`}
          onMouseLeave={e => e.currentTarget.style.background = `${color}08`}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{c.client}</div>
            <div style={{ fontSize: 11, color: B.txtD }}>{c.ref} · {c.insurer} · {c.attorney}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...S.mono, fontSize: 14, fontWeight: 700, color }}>{c.daysRemaining}d</div>
            <div style={{ ...S.mono, fontSize: 10, color: B.txtD }}>{fmtD(c.sol)}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ ...S.card, borderColor: data.critical.length > 0 ? `${B.danger}40` : `${B.gold}30` }}>
      <h3 style={{ ...S.secT, display: "flex", alignItems: "center", gap: 8 }}>
        <span>🚨</span> SOL Reminders
        <span style={{ ...S.badge, background: data.critical.length > 0 ? B.dangerBg : B.goldBg, color: data.critical.length > 0 ? B.danger : B.gold, marginLeft: 8 }}>{data.total} cases</span>
      </h3>
      <Section title="Critical — Under 30 Days" items={data.critical} color={B.danger} icon="🔴" />
      <Section title="Warning — Under 60 Days" items={data.warning} color={B.gold} icon="🟡" />
      <Section title="Attention — Under 90 Days" items={data.attention} color="#5b8def" icon="🔵" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DOCUMENT GENERATOR PANEL
// ═══════════════════════════════════════════════════════════
function DocGenPanel({ caseId, caseRef }) {
  const [templates, setTemplates] = useState([]);
  const [generating, setGenerating] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/docgen").then(r => r.json()).then(d => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  const generate = async (key) => {
    setGenerating(key); setResult(null);
    try {
      const resp = await fetch("/api/docgen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, template: key }),
      });
      const data = await resp.json();
      if (data.error) setResult({ error: data.error });
      else setResult(data);
    } catch (err) { setResult({ error: err.message }); }
    setGenerating(null);
  };

  const copyToClipboard = () => {
    if (result?.content) navigator.clipboard.writeText(result.content);
  };

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <h3 style={{ ...S.secT, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span>📝</span> Generate Document
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: result ? 16 : 0 }}>
        {templates.map(t => (
          <button key={t.key} onClick={() => generate(t.key)} disabled={generating === t.key}
            style={{ ...S.btnO, fontSize: 12, padding: "6px 14px", opacity: generating === t.key ? 0.5 : 1 }}>
            {generating === t.key ? "⏳ Generating..." : t.name}
          </button>
        ))}
      </div>
      {result && !result.error && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.gold }}>{result.templateName}</div>
            <button onClick={copyToClipboard} style={{ ...S.btnO, fontSize: 11, padding: "4px 10px" }}>📋 Copy</button>
          </div>
          <pre style={{ background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: 16, fontSize: 12, color: B.txtM, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.5 }}>
            {result.content}
          </pre>
        </div>
      )}
      {result?.error && (
        <div style={{ padding: 12, background: B.dangerBg, borderRadius: 6, fontSize: 12, color: B.danger }}>{result.error}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TASKS PANEL (for case detail + global)
// ═══════════════════════════════════════════════════════════
function TasksPanel({ caseId, userId, team, showCaseColumn }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal" });
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (caseId) params.case_id = caseId;
      if (userId && !caseId) params.assigned_to = userId;
      const t = await api.listTasks(params);
      setTasks(t || []);
    } catch { setTasks([]); }
    setLoading(false);
  };

  useEffect(() => { loadTasks(); }, [caseId, userId]);

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.createTask({
        case_id: caseId || null,
        title: form.title,
        description: form.description || null,
        assigned_to: form.assigned_to || userId,
        created_by: userId,
        due_date: form.due_date || null,
        priority: form.priority,
      });
      setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal" });
      setShowForm(false);
      loadTasks();
    } catch (err) { console.error("Failed to create task:", err); }
    setSaving(false);
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await api.updateTask(task.id, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      loadTasks();
    } catch (err) { console.error("Failed to update task:", err); }
  };

  const filtered = tasks.filter(t => filter === "all" || t.status === filter);
  const priClr = p => ({ urgent: B.danger, high: "#e0a050", normal: B.txtM, low: B.txtD }[p] || B.txtM);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...S.input, width: 160 }}>
          <option value="all">All Tasks</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>+ New Task</button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: B.txtD }}>{filtered.length} task{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <input placeholder="Task title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={S.input} />
            </div>
            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={S.input}>
              <option value="">Assign to...</option>
              {(team || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={S.input} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={S.input}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createTask} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Create Task"}</button>
              <button onClick={() => setShowForm(false)} style={S.btnO}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: B.txtM }}>Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...S.card, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>☐</div>
          <div style={{ fontSize: 14, color: B.txtM }}>No tasks {filter !== "all" ? `with status "${filter}"` : "yet"}</div>
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={S.tbl}>
            <thead><tr>
              <th style={{ ...S.th, width: 40 }}></th>
              <th style={S.th}>Task</th>
              {showCaseColumn && <th style={S.th}>Case</th>}
              <th style={S.th}>Assigned</th>
              <th style={S.th}>Due</th>
              <th style={S.th}>Priority</th>
              <th style={S.th}>Status</th>
            </tr></thead>
            <tbody>
              {filtered.map(t => {
                const overdue = t.due_date && t.status !== "completed" && new Date(t.due_date + "T00:00:00") < new Date();
                return (
                  <tr key={t.id}
                    onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <span onClick={() => toggleStatus(t)} style={{ cursor: "pointer", fontSize: 16 }}>
                        {t.status === "completed" ? "✅" : "⬜"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ fontSize: 13, fontWeight: 500, textDecoration: t.status === "completed" ? "line-through" : "none", color: t.status === "completed" ? B.txtD : B.txt }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11, color: B.txtD, marginTop: 2 }}>{t.description}</div>}
                    </td>
                    {showCaseColumn && <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{t.case_id ? "📁" : "—"}</td>}
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {t.assigned && <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.assigned.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{t.assigned.initials || "?"}</div>}
                        <span style={{ fontSize: 12 }}>{t.assigned?.name?.split(" ")[0] || "—"}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, ...S.mono, fontSize: 12, color: overdue ? B.danger : B.txtM, fontWeight: overdue ? 600 : 400 }}>
                      {t.due_date ? fmtD(t.due_date) : "—"}{overdue ? " ⚠️" : ""}
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: `${priClr(t.priority)}18`, color: priClr(t.priority) }}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: t.status === "completed" ? B.greenBg : t.status === "in_progress" ? B.goldBg : `${B.txtD}15`, color: t.status === "completed" ? B.green : t.status === "in_progress" ? B.gold : B.txtM }}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
function Dash({ user, cases, onOpen, onFilterStatus }) {
  const my = cases.filter(c => c.attorney?.id === user.id || c.support?.id === user.id);
  const allActive = cases.filter(c => c.status !== "Settled" && c.status !== "Closed");
  const ac = allActive;
  const myActive = my.filter(c => c.status !== "Settled" && c.status !== "Closed");
  const sol90 = ac.filter(c => c.sol && dU(c.sol) < 90);
  const rec = cases.reduce((s, c) => s + c.totalRec, 0);
  const sc = {};
  ac.forEach(c => { sc[c.status] = (sc[c.status] || 0) + 1; });
  // Insurer breakdown
  const insurerCounts = {};
  ac.forEach(c => { if (c.insurer) insurerCounts[c.insurer] = (insurerCounts[c.insurer] || 0) + 1; });

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Welcome back, {user.name.split(" ")[0]}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { l: "All Active Cases", v: ac.length, c: B.gold },
          { l: "My Cases", v: myActive.length, c: "#5b8def" },
          { l: "Total Recoveries", v: fmt(rec), c: B.green },
          { l: "SOL < 90 Days", v: sol90.length, c: sol90.length > 0 ? B.danger : B.txtD },
          { l: "Total Cases", v: cases.length, c: B.txtM },
        ].map((x, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 11, color: B.txtM, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{x.l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: x.c, ...S.mono }}>{x.v}</div>
          </div>
        ))}
      </div>
      {/* SOL Reminders */}
      <div style={{ marginBottom: 24 }}>
        <SolRemindersPanel onOpen={onOpen} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
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

      {/* Insurer Breakdown */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <h3 style={S.secT}>🏢 Cases by Insurer</h3>
        {Object.entries(insurerCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([ins, ct]) => {
          const maxCt = Math.max(...Object.values(insurerCounts));
          return (
            <div key={ins} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 160, fontSize: 12, color: B.txtM, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins}</div>
              <div style={{ flex: 1, height: 22, background: `${B.bdr}40`, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(ct / maxCt) * 100}%`, background: `${B.navy}60`, borderRadius: 4, borderRight: `3px solid ${B.gold}` }} />
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: B.gold, ...S.mono }}>{ct}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <h3 style={S.secT}>📋 Recent Activity</h3>
        {(() => {
          const allActs = my.flatMap(cs => (cs.acts || []).map(a => ({ ...a, caseRef: cs.ref, caseClient: cs.client, caseId: cs.id }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
          return allActs.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: B.txtD, fontSize: 13 }}>No recent activity</div>
          ) : allActs.map((a, i) => (
            <div key={i} onClick={() => { const cs = cases.find(x => x.id === a.caseId); if (cs) onOpen(cs); }}
              style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < allActs.length - 1 ? `1px solid ${B.bdr}06` : "none", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = B.cardH}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: a.aClr || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{a.aIni || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{a.actor}</span>
                  <span>{aIcon(a.type)}</span>
                  <span style={{ color: B.txtM }}>{a.title}</span>
                  <span style={{ ...S.mono, fontSize: 10, color: B.gold, marginLeft: "auto", flexShrink: 0 }}>{a.caseRef}</span>
                </div>
                {a.desc && <div style={{ fontSize: 11, color: B.txtD, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.desc}</div>}
              </div>
              <div style={{ ...S.mono, fontSize: 10, color: B.txtD, flexShrink: 0 }}>{fmtD(a.date)}</div>
            </div>
          ));
        })()}
      </div>

      {/* Cases Needing Attention */}
      {(() => {
        const stale = ac.filter(c => {
          const lastAct = (c.acts || []).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          if (!lastAct) return true;
          return (new Date() - new Date(lastAct.date)) / 86400000 > 30;
        }).slice(0, 10);
        return stale.length > 0 ? (
          <div style={{ ...S.card, borderColor: `${B.gold}30` }}>
            <h3 style={{ ...S.secT, display: "flex", alignItems: "center", gap: 8 }}>
              <span>👀</span> Cases Needing Attention
              <span style={{ ...S.badge, background: B.goldBg, color: B.gold }}>{stale.length}</span>
            </h3>
            <div style={{ fontSize: 11, color: B.txtD, marginBottom: 12 }}>No activity in 30+ days</div>
            {stale.map(c => {
              const lastAct = (c.acts || []).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
              const days = lastAct ? Math.floor((new Date() - new Date(lastAct.date)) / 86400000) : null;
              return (
                <div key={c.id} onClick={() => onOpen(c)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", marginBottom: 4, borderRadius: 6, cursor: "pointer", background: `${B.gold}06`, border: `1px solid ${B.gold}15` }}
                  onMouseEnter={e => e.currentTarget.style.background = `${B.gold}12`}
                  onMouseLeave={e => e.currentTarget.style.background = `${B.gold}06`}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.client}</div>
                    <div style={{ fontSize: 11, color: B.txtD }}>{c.ref} · {c.insurer} · {c.status}</div>
                  </div>
                  <div style={{ ...S.mono, fontSize: 12, color: B.gold, fontWeight: 600 }}>
                    {days != null ? `${days}d ago` : "No activity"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CASES LIST (with smart search)
// ═══════════════════════════════════════════════════════════
function Cases({ user, cases, onOpen, initialStatus, onClearFilter, team, onBatchUpdate }) {
  const [search, setSearch] = useState("");
  const [fSt, setFSt] = useState(initialStatus || "All");
  const [fJ, setFJ] = useState("All");
  const [fIns, setFIns] = useState("All");
  const [fAtt, setFAtt] = useState("All");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [scope, setScope] = useState("all");
  const [sBy, setSBy] = useState("dop");
  const [sDir, setSDir] = useState("desc");
  const [pg, setPg] = useState(0);
  const PG_SIZE = 30;
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const searchTimeout = useRef(null);
  // Batch selection
  const [selected, setSelected] = useState(new Set());
  const [batchAction, setBatchAction] = useState(null);
  const [batchVal, setBatchVal] = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);
  const tableRef = useRef(null);

  const insurers = [...new Set(cases.map(c => c.insurer).filter(Boolean))].sort();
  const attorneys = [...new Set(cases.map(c => c.attorney?.name).filter(Boolean))].sort();

  const hasFilters = fSt !== "All" || fJ !== "All" || fIns !== "All" || fAtt !== "All" || fDateFrom || fDateTo || search;

  const clearFilters = () => {
    setFSt("All"); setFJ("All"); setFIns("All"); setFAtt("All");
    setFDateFrom(""); setFDateTo(""); setSearch(""); setAiResults(null); setPg(0);
  };

  const handleSearch = (val) => {
    setSearch(val);
    setAiResults(null);
    setPg(0);
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

  const pool = scope === "mine" ? cases.filter(c => c.attorney?.id === user.id || c.support?.id === user.id) : cases;
  const fl = pool.filter(c => {
    if (search && !aiResults) {
      const q = search.toLowerCase();
      if (!c.client?.toLowerCase().includes(q) && !c.ref?.toLowerCase().includes(q) && !c.insurer?.toLowerCase().includes(q)
        && !(c.attorney?.name || "").toLowerCase().includes(q)) return false;
    }
    if (fSt !== "All" && c.status !== fSt) return false;
    if (fJ !== "All" && c.juris !== fJ) return false;
    if (fIns !== "All" && c.insurer !== fIns) return false;
    if (fAtt !== "All" && c.attorney?.name !== fAtt) return false;
    if (fDateFrom && c.dop && c.dop < fDateFrom) return false;
    if (fDateTo && c.dop && c.dop > fDateTo) return false;
    return true;
  }).sort((a, b) => {
    let va, vb;
    if (sBy === "attorney") { va = a.attorney?.name || ""; vb = b.attorney?.name || ""; }
    else if (sBy === "lastAct") {
      const aActs = (a.acts || []).sort((x, y) => new Date(y.date) - new Date(x.date));
      const bActs = (b.acts || []).sort((x, y) => new Date(y.date) - new Date(x.date));
      va = aActs[0]?.date || ""; vb = bActs[0]?.date || "";
    } else { va = a[sBy] || ""; vb = b[sBy] || ""; }
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sDir === "asc" ? -1 : 1;
    if (va > vb) return sDir === "asc" ? 1 : -1;
    return 0;
  });

  const displayCases = aiResults ? aiResults.cases : fl;
  const totalPages = Math.ceil(displayCases.length / PG_SIZE);
  const paged = aiResults ? displayCases : fl.slice(pg * PG_SIZE, (pg + 1) * PG_SIZE);

  const getLastActivity = (c) => {
    const acts = (c.acts || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    return acts[0] ? fmtD(acts[0].date) : "—";
  };

  // Batch operations
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(c => c.id)));
  };
  const executeBatch = async () => {
    if (!batchVal || selected.size === 0) return;
    const ids = [...selected];
    for (const id of ids) {
      if (batchAction === "status") await onBatchUpdate(id, { status: batchVal });
      else if (batchAction === "attorney") {
        const member = (team || []).find(m => m.id === batchVal);
        if (member) await onBatchUpdate(id, { attorney: member });
      }
    }
    setSelected(new Set());
    setBatchAction(null);
    setBatchVal("");
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, paged.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && focusIdx >= 0 && focusIdx < paged.length) {
        e.preventDefault();
        onOpen(aiResults ? { id: paged[focusIdx].id } : paged[focusIdx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusIdx, paged, aiResults, onOpen]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Cases</h2>
        <div style={{ display: "flex", gap: 4, background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 8, padding: 2 }}>
          {[["all", "All Cases"], ["mine", "My Cases"]].map(([k, l]) => (
            <button key={k} onClick={() => { setScope(k); setPg(0); }} style={{
              padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: scope === k ? B.gold : "transparent", color: scope === k ? "#000" : B.txtM,
              fontFamily: "'DM Sans',sans-serif",
            }}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: B.txtM }}>
          Showing <span style={{ ...S.mono, color: B.gold, fontWeight: 600 }}>{displayCases.length}</span> of <span style={{ ...S.mono, fontWeight: 600 }}>{cases.length}</span> cases
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ ...S.card, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
            <input
              placeholder="Search cases, clients, insurers..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{ ...S.input, paddingLeft: 32 }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: B.txtD }}>🔍</span>
            {aiLoading && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: B.gold }}>⏳</span>}
          </div>
          <select value={fSt} onChange={e => { setFSt(e.target.value); setPg(0); }} style={{ ...S.input, width: 170, flex: "0 0 auto" }}>
            <option value="All">All Statuses</option>
            {CSTATS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={fAtt} onChange={e => { setFAtt(e.target.value); setPg(0); }} style={{ ...S.input, width: 150, flex: "0 0 auto" }}>
            <option value="All">All Attorneys</option>
            {attorneys.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={fJ} onChange={e => { setFJ(e.target.value); setPg(0); }} style={{ ...S.input, width: 100, flex: "0 0 auto" }}>
            <option value="All">All States</option>
            {JURIS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={fIns} onChange={e => { setFIns(e.target.value); setPg(0); }} style={{ ...S.input, width: 160, flex: "0 0 auto" }}>
            <option value="All">All Insurers</option>
            {insurers.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        {/* Date range row */}
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Opened</span>
          <input type="date" value={fDateFrom} onChange={e => { setFDateFrom(e.target.value); setPg(0); }} style={{ ...S.input, width: 150 }} placeholder="From" />
          <span style={{ fontSize: 11, color: B.txtD }}>to</span>
          <input type="date" value={fDateTo} onChange={e => { setFDateTo(e.target.value); setPg(0); }} style={{ ...S.input, width: 150 }} placeholder="To" />
          {hasFilters && (
            <button onClick={clearFilters} style={{ ...S.btnO, fontSize: 11, padding: "6px 12px", color: B.danger, borderColor: `${B.danger}40` }}>
              ✕ Clear Filters
            </button>
          )}
        </div>
      </div>

      {aiResults && (
        <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 6, background: `${B.gold}08`, border: `1px solid ${B.gold}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: B.gold }}>🤖 {aiResults.description}</span>
          <button onClick={() => { setAiResults(null); setSearch(""); }} style={{ ...S.btnO, fontSize: 11, padding: "2px 8px" }}>Clear</button>
        </div>
      )}

      {/* Batch Actions Bar */}
      {selected.size > 0 && (
        <div style={{ ...S.card, padding: "10px 16px", marginBottom: 12, borderColor: `${B.gold}40`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: B.gold }}>{selected.size} selected</span>
          <select value={batchAction || ""} onChange={e => { setBatchAction(e.target.value || null); setBatchVal(""); }} style={{ ...S.input, width: 160 }}>
            <option value="">Bulk action...</option>
            <option value="status">Change Status</option>
            <option value="attorney">Assign Attorney</option>
          </select>
          {batchAction === "status" && (
            <select value={batchVal} onChange={e => setBatchVal(e.target.value)} style={{ ...S.input, width: 200 }}>
              <option value="">Select status...</option>
              {CSTATS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          {batchAction === "attorney" && (
            <select value={batchVal} onChange={e => setBatchVal(e.target.value)} style={{ ...S.input, width: 200 }}>
              <option value="">Select attorney...</option>
              {(team || []).filter(m => m.role === "Attorney" || m.title?.includes("Attorney")).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              {(team || []).filter(m => m.role !== "Attorney" && !m.title?.includes("Attorney")).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          {batchAction && batchVal && (
            <button onClick={executeBatch} style={{ ...S.btn, fontSize: 12, padding: "6px 14px" }}>Apply</button>
          )}
          <button onClick={() => { setSelected(new Set()); setBatchAction(null); }} style={{ ...S.btnO, fontSize: 11, padding: "6px 10px" }}>Cancel</button>
        </div>
      )}

      <div ref={tableRef} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={S.tbl}>
          <thead><tr>
            <th style={{ ...S.th, width: 36, textAlign: "center" }}>
              <input type="checkbox" checked={paged.length > 0 && selected.size === paged.length} onChange={toggleAll}
                style={{ cursor: "pointer", accentColor: B.gold }} />
            </th>
            {[["ref", "Case #"], ["client", "Client"], ["status", "Status"], ["insurer", "Insurer"], ["attorney", "Attorney"], ["juris", "State"], ["dop", "Opened"], ["sol", "SOL"], ["lastAct", "Last Activity"]].map(([c, l]) => (
              <th key={c} onClick={() => { if (sBy === c) setSDir(d => d === "asc" ? "desc" : "asc"); else { setSBy(c); setSDir("desc"); } }} style={{ ...S.th, cursor: "pointer", userSelect: "none" }}>
                {l}{sBy === c ? (sDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {paged.map((c, idx) => {
              const sc = stClr(c.status);
              const sd = c.sol ? dU(c.sol) : null;
              const isFocused = idx === focusIdx;
              return (
                <tr key={c.id} onClick={() => onOpen(aiResults ? { id: c.id } : c)}
                  style={{ cursor: "pointer", background: isFocused ? `${B.gold}10` : "transparent", outline: isFocused ? `1px solid ${B.gold}40` : "none" }}
                  onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = B.cardH; }}
                  onMouseLeave={e => { if (!isFocused) e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={e => toggleSelect(c.id, e)}
                      style={{ cursor: "pointer", accentColor: B.gold }} />
                  </td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.gold, fontWeight: 500 }}>{c.ref}</td>
                  <td style={{ ...S.td, fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.client}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: sc.bg, color: sc.t }}>{c.status}</span></td>
                  <td style={{ ...S.td, fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.insurer}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {c.attorney?.ini && <div style={{ width: 22, height: 22, borderRadius: "50%", background: c.attorney.clr || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{c.attorney.ini}</div>}
                      <span style={{ fontSize: 12 }}>{c.attorney?.name?.split(" ")[0] || "—"}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{c.juris || c.jurisdiction}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.txtM }}>{fmtD(c.dop)}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, fontWeight: 600, color: sd != null ? (sd < 30 ? B.danger : sd < 90 ? B.gold : B.txtM) : B.txtD }}>{c.sol ? fmtD(c.sol) : "—"}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 11, color: B.txtD }}>{getLastActivity(c)}</td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr><td colSpan={10} style={{ ...S.td, textAlign: "center", padding: 40, color: B.txtD }}>No cases match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button onClick={() => setPg(Math.max(0, pg - 1))} disabled={pg === 0}
            style={{ ...S.btnO, fontSize: 12, padding: "6px 12px", opacity: pg === 0 ? 0.4 : 1 }}>← Prev</button>
          <span style={{ ...S.mono, fontSize: 12, color: B.txtM }}>Page {pg + 1} of {totalPages}</span>
          <button onClick={() => setPg(Math.min(totalPages - 1, pg + 1))} disabled={pg >= totalPages - 1}
            style={{ ...S.btnO, fontSize: 12, padding: "6px 12px", opacity: pg >= totalPages - 1 ? 0.4 : 1 }}>Next →</button>
        </div>
      )}
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
function AddNoteModal({ caseId, user, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const now = new Date();
      await api.createActivity({
        case_id: caseId,
        type: "note",
        title: "Note added",
        description: text.trim(),
        actor_name: user?.name || "Unknown",
        actor_initials: user?.ini || "?",
        actor_color: user?.clr || "#888",
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().slice(0, 5),
      });
      onSaved();
      onClose();
    } catch (err) { console.error("Failed to save note:", err); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: 520, background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✍️</span> Add Note
        </h3>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter your note..." rows={5}
          style={{ ...S.input, resize: "vertical", minHeight: 100, marginBottom: 16 }} autoFocus />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={S.btnO}>Cancel</button>
          <button onClick={save} disabled={saving || !text.trim()} style={{ ...S.btn, opacity: saving || !text.trim() ? 0.5 : 1 }}>
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseOverview({ c }) {
  const d = c.cd || {};
  const negs = (c.negs || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  const ests = c.ests || [];
  const hiEst = ests.length > 0 ? Math.max(...ests.map(e => e.amount)) : 0;
  const loEst = ests.length > 0 ? Math.min(...ests.map(e => e.amount)) : 0;

  return (
    <div>
      {/* Claim snapshot */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={S.card}>
          <div style={{ fontSize: 11, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>📋 Claim Info</div>
          {[
            ["Claim #", d.claimNumber], ["Policy #", d.policyNumber], ["Insurer", d.insurer],
            ["Cause of Loss", d.causeOfLoss], ["Property", d.propAddr],
          ].map(([l, v], i) => v ? (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: B.txtD }}>{l}</span>
              <span style={{ color: B.txt, fontWeight: 500, ...S.mono, textAlign: "right", maxWidth: "60%" }}>{v}</span>
            </div>
          ) : null)}
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 11, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>👤 Adjuster</div>
          {d.adjuster ? <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{d.adjuster}</div>
            {d.adjPhone && <div style={{ fontSize: 12, marginBottom: 4 }}><a href={`tel:${d.adjPhone}`} style={{ color: B.gold, textDecoration: "none" }}>📞 {d.adjPhone}</a></div>}
            {d.adjEmail && <div style={{ fontSize: 12 }}><a href={`mailto:${d.adjEmail}`} style={{ color: B.gold, textDecoration: "none" }}>✉️ {d.adjEmail}</a></div>}
          </> : <div style={{ fontSize: 12, color: B.txtD }}>No adjuster on file</div>}
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 11, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>📊 Estimates</div>
          {ests.length > 0 ? <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: B.txtD }}>Highest</span>
              <span style={{ ...S.mono, color: B.green, fontWeight: 600 }}>{fmt(hiEst)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: B.txtD }}>Lowest</span>
              <span style={{ ...S.mono, color: B.danger, fontWeight: 600 }}>{fmt(loEst)}</span>
            </div>
            <div style={{ fontSize: 11, color: B.txtD, marginTop: 4 }}>{ests.length} estimate{ests.length !== 1 ? "s" : ""} on file</div>
          </> : <div style={{ fontSize: 12, color: B.txtD }}>No estimates yet</div>}
        </div>
      </div>

      {/* Litigation summary if in litigation */}
      {c.ld && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: `${B.purple}30` }}>
          <div style={{ fontSize: 11, color: B.purple, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚖️</span> Litigation
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
            {[
              ["Case #", c.ld.caseNum], ["Court", c.ld.court], ["Judge", c.ld.judge],
              ["Trial", c.ld.trialDate ? `${fmtD(c.ld.trialDate)} (${dU(c.ld.trialDate)}d)` : "Not set"],
            ].map(([l, v], i) => (
              <div key={i}>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: B.txt, ...S.mono }}>{v || "—"}</div>
              </div>
            ))}
          </div>
          {c.ld.oppCounsel && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${B.bdr}`, fontSize: 12, color: B.txtM }}>
              Opposing: <span style={{ color: B.txt, fontWeight: 500 }}>{c.ld.oppCounsel}</span>
              {c.ld.oppFirm && <span> ({c.ld.oppFirm})</span>}
            </div>
          )}
        </div>
      )}

      {/* Negotiation timeline */}
      {negs.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ fontSize: 11, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span>💰</span> Negotiation Timeline
          </div>
          <div style={{ position: "relative", paddingLeft: 20 }}>
            <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 2, background: B.bdr }} />
            {negs.map((n, i) => (
              <div key={i} style={{ position: "relative", paddingBottom: i < negs.length - 1 ? 16 : 0, paddingLeft: 20 }}>
                <div style={{ position: "absolute", left: -17, top: 4, width: 10, height: 10, borderRadius: "50%", background: nClr(n.type), border: `2px solid ${B.card}` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <span style={{ ...S.badge, background: `${nClr(n.type)}18`, color: nClr(n.type), marginRight: 8 }}>{nLbl(n.type)}</span>
                    {n.type !== "denial" && <span style={{ ...S.mono, fontSize: 14, fontWeight: 700, color: nClr(n.type) }}>{fmt(n.amount)}</span>}
                  </div>
                  <span style={{ ...S.mono, fontSize: 11, color: B.txtD }}>{fmtD(n.date)}</span>
                </div>
                {n.notes && <div style={{ fontSize: 12, color: B.txtM, marginTop: 4 }}>{n.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CaseTimeline({ c }) {
  const events = [];
  if (c.dop) events.push({ date: c.dop, type: "open", icon: "📂", label: "Case Opened", desc: `${c.type} — ${c.juris}` });
  if (c.dol) events.push({ date: c.dol, type: "loss", icon: "🏠", label: "Date of Loss", desc: c.cd?.causeOfLoss || "" });
  if (c.cd?.dateReported) events.push({ date: c.cd.dateReported, type: "reported", icon: "📞", label: "Claim Reported" });
  if (c.cd?.dateDenied) events.push({ date: c.cd.dateDenied, type: "denied", icon: "❌", label: "Claim Denied", color: B.danger });
  (c.negs || []).forEach(n => events.push({ date: n.date, type: "neg", icon: "💰", label: `${nLbl(n.type)}${n.type !== "denial" ? ": " + fmt(n.amount) : ""}`, desc: n.notes, color: nClr(n.type) }));
  (c.ests || []).forEach(e => events.push({ date: e.date, type: "est", icon: "📊", label: `Estimate: ${fmt(e.amount)}`, desc: `${e.type} — ${e.vendor}`, color: B.green }));
  (c.pleads || []).forEach(p => events.push({ date: p.date, type: "plead", icon: "⚖️", label: p.type, desc: `Filed by ${p.filedBy} — ${p.status}`, color: B.purple }));
  if (c.ld?.filedDate) events.push({ date: c.ld.filedDate, type: "filed", icon: "⚖️", label: "Complaint Filed", desc: c.ld.court, color: B.purple });
  (c.acts || []).forEach(a => events.push({ date: a.date, type: "act", icon: aIcon(a.type), label: a.title, desc: a.desc, actor: a.actor, aClr: a.aClr, aIni: a.aIni }));

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={{ position: "relative", paddingLeft: 28 }}>
      <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2, background: B.bdr }} />
      {events.length === 0 ? (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: B.txtD, marginLeft: -28 }}>No timeline events</div>
      ) : events.map((ev, i) => (
        <div key={i} style={{ position: "relative", paddingBottom: 20, paddingLeft: 24 }}>
          <div style={{ position: "absolute", left: -21, top: 4, width: 12, height: 12, borderRadius: "50%", background: ev.color || B.txtM, border: `2px solid ${B.card}`, zIndex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>{ev.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: ev.color || B.txt }}>{ev.label}</span>
              {ev.actor && (
                <span style={{ fontSize: 11, color: B.txtM }}>by {ev.actor}</span>
              )}
            </div>
            <span style={{ ...S.mono, fontSize: 11, color: B.txtD, flexShrink: 0 }}>{fmtD(ev.date)}</span>
          </div>
          {ev.desc && <div style={{ fontSize: 12, color: B.txtD, marginTop: 2 }}>{ev.desc}</div>}
        </div>
      ))}
    </div>
  );
}

function CaseNotesTab({ c, caseId, user, onRefresh }) {
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const notes = (c.acts || []).filter(a => a.type === "note").sort((a, b) => new Date(b.date) - new Date(a.date));

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const now = new Date();
      await api.createActivity({
        case_id: caseId,
        type: "note",
        title: "Note added",
        description: noteText.trim(),
        actor_name: user?.name || "Unknown",
        actor_initials: user?.ini || "?",
        actor_color: user?.clr || "#888",
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().slice(0, 5),
      });
      setNoteText("");
      if (onRefresh) onRefresh();
    } catch (err) { console.error("Failed to save note:", err); }
    setSaving(false);
  };

  return (
    <div>
      {/* Add note form */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>✍️</span> Add Note
        </div>
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your note..."
          rows={3} style={{ ...S.input, resize: "vertical", minHeight: 70, marginBottom: 10 }} />
        <button onClick={addNote} disabled={saving || !noteText.trim()} style={{ ...S.btn, fontSize: 12, opacity: saving || !noteText.trim() ? 0.5 : 1 }}>
          {saving ? "Saving..." : "Save Note"}
        </button>
      </div>
      {/* Existing notes */}
      {notes.length === 0 ? (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: B.txtD }}>No notes yet</div>
      ) : (
        <div style={{ ...S.card, padding: 0 }}>
          {notes.map((a, i) => (
            <div key={a.id || i} style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: i < notes.length - 1 ? `1px solid ${B.bdr}06` : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: a.aClr || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{a.aIni || "?"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.actor}</span>
                  <span style={{ ...S.mono, fontSize: 11, color: B.txtD, marginLeft: "auto" }}>{fmtD(a.date)} {a.time}</span>
                </div>
                <div style={{ fontSize: 13, color: B.txtM, lineHeight: 1.5 }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseDetail({ c, onBack, onUpdate, user, team }) {
  const [tab, setTab] = useState("overview");
  const [noteModal, setNoteModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Escape to close edit/modals
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (noteModal) setNoteModal(false);
        else if (editing) setEditing(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [noteModal, editing]);

  const startEdit = () => {
    setEditForm({
      jurisdiction: c.juris || "", insurer: c.insurer || "",
      claim_number: c.cn || "", policy_number: c.pn || "",
      date_of_loss: c.dol || "", statute_of_limitations: c.sol || "",
      client_phone: c.clientPhone || "", client_email: c.clientEmail || "",
    });
    setEditing(true);
    setFeedback(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateCase(c.id, editForm);
      if (onUpdate) {
        onUpdate(c.id, {
          juris: editForm.jurisdiction, insurer: editForm.insurer,
          cn: editForm.claim_number, pn: editForm.policy_number,
          dol: editForm.date_of_loss, sol: editForm.statute_of_limitations,
          clientPhone: editForm.client_phone, clientEmail: editForm.client_email,
        });
      }
      setEditing(false);
      setFeedback({ type: "success", msg: "Case updated successfully" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to save: " + err.message });
    }
    setSaving(false);
  };

  const tabs = [
    { id: "overview", l: "Overview" }, { id: "notes", l: "Notes" },
    { id: "claim", l: "Claim Details" },
    { id: "litigation", l: "Litigation" }, { id: "negotiations", l: "Negotiations" },
    { id: "estimates", l: "Estimates" }, { id: "pleadings", l: "Pleadings" },
    { id: "timeline", l: "Timeline" }, { id: "tasks", l: "Tasks" },
    { id: "docs", l: "Documents" }, { id: "docgen", l: "Generate Docs" },
  ];
  const sc = stClr(c.status);
  const sd = c.sol ? dU(c.sol) : null;

  const changeStatus = (newSt) => { if (onUpdate) onUpdate(c.id, { status: newSt }); };

  // Get recent activity for sidebar
  const recentActs = (c.acts || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  return (
    <div>
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

      {/* Feedback toast */}
      {feedback && (
        <div style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: feedback.type === "success" ? B.greenBg : B.dangerBg,
          color: feedback.type === "success" ? B.green : B.danger,
          border: `1px solid ${feedback.type === "success" ? B.green : B.danger}30`,
        }}>
          {feedback.type === "success" ? "✅" : "❌"} {feedback.msg}
        </div>
      )}

      {/* Two-column layout: Main (60%) + Sidebar (40%) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 20 }}>
        {/* Left column - Key info cards */}
        <div>
          {/* Inline Edit Panel */}
          {editing && (
            <div style={{ ...S.card, marginBottom: 16, borderColor: `${B.gold}40` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: B.gold, margin: 0 }}>✏️ Edit Case Details</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={S.btnO}>Cancel</button>
                  <button onClick={saveEdit} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "💾 Save Changes"}</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { k: "jurisdiction", l: "Jurisdiction", type: "select", opts: JURIS },
                  { k: "insurer", l: "Insurer" },
                  { k: "claim_number", l: "Claim Number" },
                  { k: "policy_number", l: "Policy Number" },
                  { k: "date_of_loss", l: "Date of Loss", type: "date" },
                  { k: "statute_of_limitations", l: "Statute of Limitations", type: "date" },
                  { k: "client_phone", l: "Client Phone" },
                  { k: "client_email", l: "Client Email" },
                ].map(f => (
                  <div key={f.k}>
                    <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{f.l}</div>
                    {f.type === "select" ? (
                      <select value={editForm[f.k] || ""} onChange={e => setEditForm({ ...editForm, [f.k]: e.target.value })} style={S.input}>
                        <option value="">—</option>
                        {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type || "text"} value={editForm[f.k] || ""} onChange={e => setEditForm({ ...editForm, [f.k]: e.target.value })} style={S.input} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { l: "Attorney", v: c.attorney?.name || "—", c: c.attorney?.clr || "#888" },
              { l: "Support", v: c.support?.name || "—", c: c.support?.clr || "#888" },
              { l: "Date of Loss", v: fmtD(c.dol), c: B.txtM },
              { l: "Negotiations", v: (c.negs || []).length, c: "#5b8def" },
              { l: "Recovery", v: c.totalRec > 0 ? fmt(c.totalRec) : "—", c: c.totalRec > 0 ? B.green : B.txtD },
              { l: "Client Phone", v: c.clientPhone || "—", c: c.clientPhone ? B.gold : B.txtD },
            ].map((x, i) => (
              <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: x.c, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* AI Summary inline */}
          <AiSummaryPanel caseId={c.id} />
        </div>

        {/* Right column - Activity log + Quick actions */}
        <div>
          {/* Quick Actions */}
          <div style={{ ...S.card, padding: "12px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!editing && <button onClick={startEdit} style={{ ...S.btnO, fontSize: 11, padding: "5px 12px" }}>✏️ Edit</button>}
              <button onClick={() => setNoteModal(true)} style={{ ...S.btn, fontSize: 11, padding: "5px 12px" }}>✍️ Add Note</button>
              <button onClick={() => setTab("docs")} style={{ ...S.btnO, fontSize: 11, padding: "5px 12px" }}>📄 Docs</button>
              <button onClick={() => setTab("docgen")} style={{ ...S.btnO, fontSize: 11, padding: "5px 12px" }}>📝 Generate</button>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ ...S.card, padding: 0, maxHeight: 420, overflowY: "auto" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.bdr}`, fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, position: "sticky", top: 0, background: B.card, zIndex: 1 }}>
              Recent Activity ({(c.acts || []).length})
            </div>
            {recentActs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: B.txtD, fontSize: 12 }}>No activity</div>
            ) : recentActs.map((a, i) => (
              <div key={a.id || i} style={{ display: "flex", gap: 10, padding: "10px 16px", borderBottom: i < recentActs.length - 1 ? `1px solid ${B.bdr}06` : "none" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: a.aClr || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{a.aIni || "?"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{a.actor?.split(" ")[0]}</span>
                    <span>{aIcon(a.type)}</span>
                    <span style={{ color: B.txtM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                  </div>
                  {a.desc && <div style={{ fontSize: 10, color: B.txtD, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.desc}</div>}
                </div>
                <span style={{ ...S.mono, fontSize: 9, color: B.txtD, flexShrink: 0 }}>{fmtD(a.date)}</span>
              </div>
            ))}
            {(c.acts || []).length > 8 && (
              <div onClick={() => setTab("notes")} style={{ padding: "8px 16px", textAlign: "center", fontSize: 11, color: B.gold, cursor: "pointer", borderTop: `1px solid ${B.bdr}` }}>
                View all activity →
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${B.bdr}`, paddingBottom: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 14px", border: "none",
            borderBottom: tab === t.id ? `2px solid ${B.gold}` : "2px solid transparent",
            background: "transparent", color: tab === t.id ? B.gold : B.txtM,
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", marginBottom: -1, whiteSpace: "nowrap",
          }}>
            {t.l}
            {t.id === "negotiations" && (c.negs || []).length > 0 && <span style={{ marginLeft: 6, ...S.mono, fontSize: 10, background: `${B.gold}20`, color: B.gold, padding: "1px 6px", borderRadius: 10 }}>{(c.negs || []).length}</span>}
            {t.id === "notes" && (c.acts || []).length > 0 && <span style={{ marginLeft: 6, ...S.mono, fontSize: 10, background: `${B.txtD}20`, color: B.txtM, padding: "1px 6px", borderRadius: 10 }}>{(c.acts || []).length}</span>}
            {t.id === "pleadings" && (c.pleads || []).length > 0 && <span style={{ marginLeft: 6, ...S.mono, fontSize: 10, background: `${B.purple}20`, color: B.purple, padding: "1px 6px", borderRadius: 10 }}>{(c.pleads || []).length}</span>}
          </button>
        ))}
      </div>

      {noteModal && <AddNoteModal caseId={c.id} user={user} onClose={() => setNoteModal(false)} onSaved={() => setRefreshKey(k => k + 1)} />}

      {tab === "overview" && <CaseOverview c={c} />}
      {tab === "notes" && <CaseNotesTab c={c} caseId={c.id} user={user} onRefresh={() => setRefreshKey(k => k + 1)} key={refreshKey} />}
      {tab === "claim" && <ClaimDetails c={c} />}
      {tab === "litigation" && <LitDetails c={c} />}
      {tab === "negotiations" && <Negotiations c={c} />}
      {tab === "estimates" && <Estimates c={c} />}
      {tab === "pleadings" && <Pleadings c={c} />}
      {tab === "timeline" && <CaseTimeline c={c} />}
      {tab === "tasks" && <TasksPanel caseId={c.id} userId={user?.id} team={team} />}
      {tab === "docs" && <DocumentBrowser clientName={c.client} />}
      {tab === "docgen" && <DocGenPanel caseId={c.id} caseRef={c.ref} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TASKS KANBAN (grouped by time)
// ═══════════════════════════════════════════════════════════
function TasksKanban({ userId, team, cases }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal" });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("board"); // board or list

  const loadTasks = async () => {
    setLoading(true);
    try {
      const t = await api.listTasks({});
      setTasks((t || []).filter(t => t.status !== "completed"));
    } catch { setTasks([]); }
    setLoading(false);
  };

  useEffect(() => { loadTasks(); }, [userId]);

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.createTask({
        title: form.title, description: form.description || null,
        assigned_to: form.assigned_to || userId, created_by: userId,
        due_date: form.due_date || null, priority: form.priority,
      });
      setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal" });
      setShowForm(false);
      loadTasks();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const toggleDone = async (task) => {
    try {
      await api.updateTask(task.id, { status: "completed", completed_at: new Date().toISOString() });
      loadTasks();
    } catch (err) { console.error(err); }
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

  const groups = [
    { key: "overdue", label: "🔴 Overdue", color: B.danger, items: tasks.filter(t => t.due_date && new Date(t.due_date + "T00:00:00") < today) },
    { key: "today", label: "🟡 Today", color: B.gold, items: tasks.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date + "T00:00:00"); return d >= today && d < new Date(today.getTime() + 86400000); }) },
    { key: "week", label: "🔵 This Week", color: "#5b8def", items: tasks.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date + "T00:00:00"); return d >= new Date(today.getTime() + 86400000) && d <= endOfWeek; }) },
    { key: "later", label: "⚪ Later / No Date", color: B.txtM, items: tasks.filter(t => !t.due_date || new Date(t.due_date + "T00:00:00") > endOfWeek) },
  ];

  const priClr = p => ({ urgent: B.danger, high: "#e0a050", normal: B.txtM, low: B.txtD }[p] || B.txtM);

  const caseRef = (caseId) => { const c = (cases || []).find(x => x.id === caseId); return c ? c.ref : null; };

  const TaskCard = ({ t }) => (
    <div style={{ ...S.card, padding: "12px 16px", marginBottom: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span onClick={() => toggleDone(t)} style={{ cursor: "pointer", fontSize: 16, flexShrink: 0, marginTop: 2 }}>⬜</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.title}</div>
        {t.description && <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>{t.description}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {t.case_id && caseRef(t.case_id) && <span style={{ ...S.mono, fontSize: 10, color: B.gold, background: B.goldBg, padding: "1px 6px", borderRadius: 10 }}>{caseRef(t.case_id)}</span>}
          <span style={{ ...S.badge, fontSize: 10, background: `${priClr(t.priority)}18`, color: priClr(t.priority) }}>{t.priority}</span>
          {t.due_date && <span style={{ ...S.mono, fontSize: 10, color: B.txtD }}>{fmtD(t.due_date)}</span>}
          {t.assigned && <span style={{ fontSize: 10, color: B.txtM }}>{t.assigned.name?.split(" ")[0]}</span>}
        </div>
      </div>
    </div>
  );

  if (loading) return <div style={{ ...S.card, padding: 40, textAlign: "center", color: B.txtM }}>Loading tasks...</div>;

  if (tasks.length === 0) return (
    <div style={{ ...S.card, padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>☐</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Active Tasks</div>
      <div style={{ fontSize: 13, color: B.txtM, marginBottom: 20 }}>Tasks you create will appear here, grouped by due date.</div>
      <button onClick={() => setShowForm(true)} style={S.btn}>+ Create First Task</button>
      {showForm && (
        <div style={{ ...S.card, marginTop: 20, textAlign: "left" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}><input placeholder="Task title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} /></div>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={S.input} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={S.input}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createTask} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Create"}</button>
              <button onClick={() => setShowForm(false)} style={S.btnO}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>+ New Task</button>
        <button onClick={() => setView(v => v === "board" ? "list" : "board")} style={S.btnO}>{view === "board" ? "List View" : "Board View"}</button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: B.txtD }}>{tasks.length} active task{tasks.length !== 1 ? "s" : ""}</div>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}><input placeholder="Task title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} /></div>
            <div style={{ gridColumn: "1/-1" }}><input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={S.input} /></div>
            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={S.input}>
              <option value="">Assign to...</option>
              {(team || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={S.input} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={S.input}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createTask} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Create"}</button>
              <button onClick={() => setShowForm(false)} style={S.btnO}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "flex-start" }}>
          {groups.map(g => (
            <div key={g.key}>
              <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {g.label}
                <span style={{ ...S.mono, fontSize: 10, background: `${g.color}18`, padding: "1px 6px", borderRadius: 10 }}>{g.items.length}</span>
              </div>
              {g.items.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: B.txtD, background: `${B.card}80`, borderRadius: 8, border: `1px dashed ${B.bdr}` }}>None</div>
              ) : g.items.map(t => <TaskCard key={t.id} t={t} />)}
            </div>
          ))}
        </div>
      ) : (
        <TasksPanel userId={userId} team={team} showCaseColumn />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CALENDAR VIEW
// ═══════════════════════════════════════════════════════════
function CalendarView({ cases, onOpen }) {
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });

  const year = month.getFullYear();
  const mo = month.getMonth();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const startDay = new Date(year, mo, 1).getDay();
  const moName = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Gather all deadlines
  const deadlines = [];
  cases.forEach(c => {
    if (c.status === "Settled" || c.status === "Closed") return;
    if (c.sol) deadlines.push({ date: c.sol, type: "SOL", label: `SOL: ${c.client}`, color: B.danger, case: c });
    if (c.ld?.trialDate) deadlines.push({ date: c.ld.trialDate, type: "Trial", label: `Trial: ${c.client}`, color: B.purple, case: c });
    if (c.ld?.medDate) deadlines.push({ date: c.ld.medDate, type: "Mediation", label: `Med: ${c.client}`, color: "#5b8def", case: c });
    if (c.ld?.discDeadline) deadlines.push({ date: c.ld.discDeadline, type: "Discovery", label: `Disc: ${c.client}`, color: B.gold, case: c });
  });

  const getDeadlinesForDay = (day) => {
    const dateStr = `${year}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return deadlines.filter(d => d.date === dateStr);
  };

  const today = new Date();
  const isToday = (day) => today.getFullYear() === year && today.getMonth() === mo && today.getDate() === day;

  // Upcoming deadlines (next 90 days)
  const now = new Date(); now.setHours(0,0,0,0);
  const upcoming = deadlines.filter(d => {
    const dt = new Date(d.date + "T00:00:00");
    const diff = (dt - now) / 86400000;
    return diff >= 0 && diff <= 90;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Calendar</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Calendar Grid */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={() => setMonth(new Date(year, mo - 1, 1))} style={S.btnO}>← Prev</button>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{moName}</h3>
            <button onClick={() => setMonth(new Date(year, mo + 1, 1))} style={S.btnO}>Next →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase" }}>{d}</div>
            ))}
            {Array.from({ length: startDay }, (_, i) => (
              <div key={`e${i}`} style={{ padding: 8, minHeight: 80 }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dls = getDeadlinesForDay(day);
              return (
                <div key={day} style={{
                  padding: 6, minHeight: 80, background: isToday(day) ? `${B.gold}10` : "transparent",
                  border: `1px solid ${isToday(day) ? B.gold + "40" : B.bdr + "40"}`, borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? B.gold : B.txtM, marginBottom: 4 }}>{day}</div>
                  {dls.slice(0, 3).map((dl, j) => (
                    <div key={j} onClick={() => onOpen(dl.case)}
                      style={{ fontSize: 10, padding: "2px 4px", marginBottom: 2, borderRadius: 3, background: `${dl.color}18`, color: dl.color, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dl.label}
                    </div>
                  ))}
                  {dls.length > 3 && <div style={{ fontSize: 9, color: B.txtD }}>+{dls.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines Sidebar */}
        <div>
          <div style={S.card}>
            <h3 style={{ ...S.secT, display: "flex", alignItems: "center", gap: 8 }}>
              ⏰ Upcoming Deadlines
              <span style={{ ...S.badge, background: B.dangerBg, color: B.danger }}>{upcoming.length}</span>
            </h3>
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {upcoming.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: B.txtD, fontSize: 13 }}>No deadlines in next 90 days</div>
              ) : upcoming.map((dl, i) => {
                const days = Math.ceil((new Date(dl.date + "T00:00:00") - now) / 86400000);
                return (
                  <div key={i} onClick={() => onOpen(dl.case)}
                    style={{ padding: "10px 0", borderBottom: i < upcoming.length - 1 ? `1px solid ${B.bdr}06` : "none", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ ...S.badge, background: `${dl.color}18`, color: dl.color, marginRight: 8 }}>{dl.type}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{dl.case.client}</span>
                      </div>
                      <span style={{ ...S.mono, fontSize: 12, fontWeight: 600, color: days < 14 ? B.danger : days < 30 ? B.gold : B.txtM }}>{days}d</span>
                    </div>
                    <div style={{ fontSize: 11, color: B.txtD, marginTop: 2 }}>
                      {dl.case.ref} · {fmtD(dl.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Cmd+K + Escape handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdBarOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        if (cmdBarOpen) setCmdBarOpen(false);
        else if (page === "caseDetail") window.history.back();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdBarOpen, page]);

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
    // Only do DB write for status changes from the dropdown (other fields are saved directly in CaseDetail)
    if (supabase && updates.status !== undefined && Object.keys(updates).length === 1) {
      try {
        await api.updateCase(id, { status: updates.status });
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
      {/* Mobile hamburger */}
      {isMobile && (
        <button onClick={() => setSidebarOpen(o => !o)} style={{
          position: "fixed", top: 12, left: 12, zIndex: 200, width: 40, height: 40,
          borderRadius: 8, border: `1px solid ${B.bdr}`, background: B.card,
          color: B.gold, fontSize: 20, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>☰</button>
      )}
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 99 }} />
      )}
      <div style={isMobile && !sidebarOpen ? { position: "fixed", left: 0, top: 0, zIndex: 100, transform: "translateX(-100%)", transition: "transform 0.2s ease" } : isMobile ? { position: "fixed", left: 0, top: 0, zIndex: 100, transform: "translateX(0)", transition: "transform 0.2s ease" } : {}}>
        <Side user={user} active={page === "caseDetail" ? "cases" : page}
          onNav={p => { navTo(p, null, "All"); if (isMobile) setSidebarOpen(false); }}
          onOut={() => { setUser(null); setSidebarOpen(false); if (supabase) api.signOut().catch(() => {}); }}
          onCmdK={() => { setCmdBarOpen(true); if (isMobile) setSidebarOpen(false); }}
          mobileOpen={isMobile ? sidebarOpen : true} onToggleMobile={() => setSidebarOpen(false)} />
      </div>
      <CommandBar open={cmdBarOpen} onClose={() => setCmdBarOpen(false)} onOpenCase={openCaseById} cases={cases} />
      <div style={{ marginLeft: isMobile ? 0 : 220, flex: 1, padding: isMobile ? "60px 16px 28px" : "28px 32px", maxWidth: 1200 }}>
        {/* Shimmer animation for skeletons */}
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        {!loading && error && (
          <div style={{ padding: "12px 16px", background: B.dangerBg, borderRadius: 8, marginBottom: 16, fontSize: 13, color: B.danger }}>
            ⚠️ {error}
          </div>
        )}
        {loading && (page === "dashboard" || page === "cases") && (page === "cases" ? <CaseListSkeleton /> : <DashboardSkeleton />)}
        {loading && page !== "dashboard" && page !== "cases" && (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: B.txtM }}>Loading...</div>
          </div>
        )}
        {!loading && page === "dashboard" && <Dash user={user} cases={cases} onOpen={openC} onFilterStatus={filterByStatus} />}
        {!loading && page === "cases" && <Cases user={user} cases={cases} onOpen={openC} initialStatus={statusFilter} onClearFilter={() => setStatusFilter("All")} team={team} onBatchUpdate={updateCase} />}
        {!loading && page === "caseDetail" && selCase && <CaseDetail c={selCase} onUpdate={updateCase} onBack={backC} user={user} team={team} />}
        {!loading && page === "calendar" && <CalendarView cases={cases} onOpen={openC} />}
        {!loading && page === "tasks" && (
          <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Tasks</h2>
            <TasksKanban userId={user.id} team={team} cases={cases} /></div>
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
