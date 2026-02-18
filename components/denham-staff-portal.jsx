"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
import * as api from "../lib/api";
import dynamic from "next/dynamic";

// Lazy-load new standalone components
const StorageDocBrowserNew = dynamic(() => import("./storage-doc-browser"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading documents...</div> });
const NegotiationTrackerNew = dynamic(() => import("./negotiation-tracker"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading negotiations...</div> });
const CaseTimelineNew = dynamic(() => import("./case-timeline"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading timeline...</div> });
const CaseTasksNew = dynamic(() => import("./case-tasks"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading tasks...</div> });
const CaseEmailsNew = dynamic(() => import("./case-emails"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading emails...</div> });
const CaseExportButton = dynamic(() => import("./case-export-button"), { ssr: false });
const CaseDetailCardsNew = dynamic(() => import("./case-detail-cards"), { ssr: false });
const GlobalSearchNew = dynamic(() => import("./global-search"), { ssr: false });
const AlertsPanelNew = dynamic(() => import("./alerts-panel"), { ssr: false });
const DashboardV2 = dynamic(() => import("./dashboard-v2"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading dashboard...</div> });
const ReportsPage = dynamic(() => import("./reports-page"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading reports...</div> });
const CaseIntakeForm = dynamic(() => import("./case-intake-form"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading intake form...</div> });
const CaseCompare = dynamic(() => import("./case-compare"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading compare...</div> });
const SettingsPage = dynamic(() => import("./settings-page"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading settings...</div> });
const AuditLog = dynamic(() => import("./audit-log"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading audit log...</div> });
const DocTemplates = dynamic(() => import("./doc-templates"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading templates...</div> });
const CaseCallsNew = dynamic(() => import("./case-calls"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading calls...</div> });
const ContactsPage = dynamic(() => import("./contacts-page"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading contacts...</div> });
const CaseContactsNew = dynamic(() => import("./case-contacts"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading contacts...</div> });
const CaseDocumentsTab = dynamic(() => import("./case-documents-tab"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading documents...</div> });
const CalendarPage = dynamic(() => import("./calendar-page"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading calendar...</div> });
const CaseCalendarTab = dynamic(() => import("./case-calendar-tab"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading calendar...</div> });
const CaseEstimatesTab = dynamic(() => import("./case-estimates-tab"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading estimates...</div> });
const CasePleadingsTab = dynamic(() => import("./case-pleadings-tab"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading pleadings...</div> });
const CaseMessagesNew = dynamic(() => import("./case-messages"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading messages...</div> });
// ComprehensiveActivityFeed is defined inline below (not imported)

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
const WORKFLOW_STAGES = [
  { key: "Intake", label: "New", icon: "📥" },
  { key: "Investigation", label: "Review", icon: "🔍" },
  { key: "Presuit Demand", label: "Presuit", icon: "📋" },
  { key: "Presuit Negotiation", label: "Demand Sent", icon: "📤" },
  { key: "Litigation - Filed", label: "Negotiation", icon: "🤝" },
  { key: "Litigation - Discovery", label: "Litigation", icon: "⚖️" },
  { key: "Appraisal", label: "Appraisal", icon: "📊" },
  { key: "Settled", label: "Settlement", icon: "💰" },
  { key: "Closed", label: "Closed", icon: "✅" },
];
const ATYPES = ["note", "call", "email", "task", "document", "negotiation",
  "pleading", "estimate", "status_change", "deadline"];
const DOC_CATEGORIES = ["Intake", "Correspondence", "Discovery", "Estimates",
  "E-Pleadings", "Photos", "Policy", "PA Files", "Pleadings"];
const LOSS_TYPES = ["Fire", "Water", "Wind", "Hail", "Other"];
const LOSS_ICON = { Fire: "🔥", Water: "💧", Wind: "🌬️", Hail: "🧊", Other: "❓" };

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

// ─── Toast System ───────────────────────────────────────────
let _toastId = 0;
let _toastListeners = [];
const toast = {
  _toasts: [],
  _notify() { _toastListeners.forEach(fn => fn([...this._toasts])); },
  success(msg) { this._add(msg, "success"); },
  error(msg) { this._add(msg, "error"); },
  info(msg) { this._add(msg, "info"); },
  _add(msg, type) {
    const id = ++_toastId;
    this._toasts.push({ id, msg, type });
    this._notify();
    setTimeout(() => { this._toasts = this._toasts.filter(t => t.id !== id); this._notify(); }, 4000);
  },
  subscribe(fn) { _toastListeners.push(fn); return () => { _toastListeners = _toastListeners.filter(f => f !== fn); }; },
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => toast.subscribe(setToasts), []);
  if (toasts.length === 0) return null;
  const colors = { success: { bg: B.greenBg, c: B.green, icon: "✅", bdr: B.green }, error: { bg: B.dangerBg, c: B.danger, icon: "❌", bdr: B.danger }, info: { bg: B.goldBg, c: B.gold, icon: "ℹ️", bdr: B.gold } };
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
      {toasts.map(t => {
        const s = colors[t.type] || colors.info;
        return (
          <div key={t.id} style={{ padding: "12px 16px", borderRadius: 8, background: B.card, border: `1px solid ${s.bdr}40`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 10, animation: "slideInRight 0.3s ease" }}>
            <span style={{ fontSize: 16 }}>{s.icon}</span>
            <span style={{ fontSize: 13, color: s.c, fontWeight: 500 }}>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SOL Helpers ─────────────────────────────────────────────
// SOL is "met" if case is in litigation, settled, or closed
// (Appraisal alone does NOT meet SOL)
function solIsMet(status) {
  if (!status) return false;
  return status.includes("Litigation") || status === "Settled" || status === "Closed";
}

// Check if a litigation case has filed complaint proof
function hasFiledComplaint(c) {
  if (!c) return false;
  return !!(c.ld?.filedDate || c.ld?.docUrl);
}

// Detailed SOL met status: "met" | "pending_proof" | "not_met"
function solMetStatus(c) {
  if (!c?.status) return "not_met";
  if (c.status === "Settled" || c.status === "Closed") return "met";
  if (c.status.includes("Litigation")) {
    return hasFiledComplaint(c) ? "met" : "pending_proof";
  }
  return "not_met";
}

// SOL Confirmation Status — human-in-the-loop confirmation tracking
// Uses heuristic: if SOL === DOL + 365 days exactly, it was auto-estimated
function solConfirmationStatus(c) {
  if (!c.sol) return { status: "not_set", label: "SOL Not Set", color: B.danger };
  if (c.dol) {
    const dolDate = new Date(c.dol + "T00:00:00");
    const autoDate = new Date(dolDate);
    autoDate.setFullYear(autoDate.getFullYear() + 1);
    const solDate = new Date(c.sol + "T00:00:00");
    // Compare date strings to avoid timezone issues
    const autoStr = autoDate.toISOString().slice(0, 10);
    if (c.sol === autoStr) return { status: "auto", label: "SOL Auto-Estimated", color: B.gold };
  }
  return { status: "confirmed", label: "SOL Confirmed", color: B.green };
}

// Calculate auto-estimated SOL date from DOL (DOL + 1 year)
function autoEstimateSol(dol) {
  if (!dol) return null;
  const d = new Date(dol + "T00:00:00");
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function solBadge(sol, status, c) {
  // If case object passed, use confirmation status
  const conf = c ? solConfirmationStatus(c) : null;
  if (!sol && c) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: B.dangerBg, color: B.danger, border: `1px solid ${B.danger}30`, whiteSpace: "nowrap" }}>
        🔴 NO SOL
      </span>
    );
  }
  if (!sol) return null;
  if (solIsMet(status)) {
    const sms = c ? solMetStatus(c) : "met";
    if (sms === "pending_proof") {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: B.goldBg, color: B.gold, border: `1px solid ${B.gold}30`, whiteSpace: "nowrap" }}>
          ⚖️ In Litigation (no complaint on file)
        </span>
      );
    }
    const filedLabel = c?.ld?.filedDate ? ` — Filed ${fmtD(c.ld.filedDate)}` : "";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: B.greenBg, color: B.green, border: `1px solid ${B.green}30`, whiteSpace: "nowrap" }}>
        ✅ SOL Met{filedLabel}
      </span>
    );
  }
  const d = Math.ceil((new Date(sol + "T00:00:00") - new Date()) / 86400000);
  // Unconfirmed auto-estimate badge
  if (conf && conf.status === "auto") {
    const expired = d < 0;
    const clr = expired ? "#ff4060" : B.gold;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: B.goldBg, color: clr, border: `1px solid ${clr}30`, whiteSpace: "nowrap" }}>
        🟡 SOL ~{Math.abs(d)}d (unconfirmed)
      </span>
    );
  }
  if (d > 90) return null;
  const expired = d < 0;
  const critical = d <= 30;
  const bg = expired ? "rgba(224,64,80,0.25)" : critical ? B.dangerBg : B.goldBg;
  const clr = expired ? "#ff4060" : critical ? B.danger : B.gold;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: bg, color: clr, border: `1px solid ${clr}30`, whiteSpace: "nowrap" }}>
      {expired ? "⛔" : critical ? "🔴" : "🟡"} {expired ? `EXPIRED ${Math.abs(d)}d ago` : `SOL ${d}d`}
    </span>
  );
}

// ─── CSV Export ──────────────────────────────────────────────
function exportCasesToCSV(cases, filename) {
  const headers = ["Ref", "Client", "Status", "Loss Type", "Insurer", "Attorney", "Jurisdiction", "Date Opened", "SOL", "Date of Loss", "Recovery", "Attorney Fees"];
  const rows = cases.map(c => [
    c.ref, c.client, c.status, c.type || "", c.insurer, c.attorney?.name || "", c.juris || "",
    c.dop || "", c.sol || "", c.dol || "", c.totalRec || 0, c.attFees || 0,
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "cases.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Print Case Summary ─────────────────────────────────────
function printCaseSummary(c) {
  const w = window.open("", "_blank");
  const negs = (c.negs || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const ests = c.ests || [];
  w.document.write(`<html><head><title>${c.ref} - ${c.client}</title><style>
    body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}
    h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;border-bottom:2px solid #000066;padding-bottom:4px;margin-top:24px}
    .meta{color:#666;font-size:13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
    .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
    .val{font-size:14px;font-weight:600;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
    th{text-align:left;border-bottom:2px solid #ddd;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#888}
    td{padding:6px 8px;border-bottom:1px solid #eee}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#f0f0f0}
    @media print{body{margin:20px}}
  </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1>${c.client}</h1><div class="meta">${c.ref} · ${c.type} · ${c.juris || ""} · ${(c.client || "").split(",")[0].split(" ").pop()} v. ${c.insurer || ""}</div></div>
      <div style="text-align:right"><div class="label">Status</div><div class="badge">${c.status}</div></div>
    </div>
    <h2>Case Information</h2>
    <div class="grid">
      <div><div class="label">Attorney</div><div class="val">${c.attorney?.name || "—"}</div></div>
      <div><div class="label">Support</div><div class="val">${c.support?.name || "—"}</div></div>
      <div><div class="label">Date of Loss</div><div class="val">${c.dol || "—"}</div></div>
      <div><div class="label">Date Opened</div><div class="val">${c.dop || "—"}</div></div>
      <div><div class="label">SOL</div><div class="val" style="${c.sol && Math.ceil((new Date(c.sol+'T00:00:00')-new Date())/86400000) < 90 ? 'color:red;font-weight:700' : ''}">${c.sol || "—"}</div></div>
      <div><div class="label">Claim #</div><div class="val">${c.cn || "—"}</div></div>
      <div><div class="label">Policy #</div><div class="val">${c.pn || "—"}</div></div>
      <div><div class="label">Client Phone</div><div class="val">${c.clientPhone || "—"}</div></div>
    </div>
    ${negs.length > 0 ? `<h2>Negotiations</h2><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Notes</th></tr></thead><tbody>${negs.map(n => `<tr><td>${n.date}</td><td>${(n.type||"").replace(/_/g," ")}</td><td>$${Number(n.amount).toLocaleString()}</td><td>${n.notes||""}</td></tr>`).join("")}</tbody></table>` : ""}
    ${ests.length > 0 ? `<h2>Estimates</h2><table><thead><tr><th>Date</th><th>Type</th><th>Vendor</th><th>Amount</th></tr></thead><tbody>${ests.map(e => `<tr><td>${e.date}</td><td>${e.type||""}</td><td>${e.vendor||""}</td><td>$${Number(e.amount).toLocaleString()}</td></tr>`).join("")}</tbody></table>` : ""}
    <div style="margin-top:32px;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:8px">Printed ${new Date().toLocaleString()} · DENHAM LAW · Confidential</div>
  </body></html>`);
  w.document.close();
  w.print();
}

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

function nLbl(t) { return (t || "").split("_").map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : "").join(" "); }

// ─── Risk Score Calculation ─────────────────────────────────
function calcRiskScore(c, litDetails) {
  let score = 0;
  const now = new Date();
  const conf = solConfirmationStatus(c);
  if (conf.status === "not_set") {
    // No SOL at all — critical risk
    score += 30;
    // If DOL exists, check proximity to 1-year floor
    if (c.dol) {
      const floorDate = autoEstimateSol(c.dol);
      if (floorDate) {
        const floorDays = dU(floorDate);
        if (floorDays < 0) score += 20; // past the 1-year floor
        else if (floorDays <= 30) score += 15;
        else if (floorDays <= 60) score += 10;
      }
    }
  } else if (conf.status === "auto") {
    // Auto-estimated, not confirmed
    score += 15;
    if (!solIsMet(c.status)) {
      const sd = dU(c.sol);
      if (sd < 0) score += 50;
      else if (sd <= 30) score += 40;
      else if (sd <= 60) score += 25;
    }
  } else if (c.sol && !solIsMet(c.status)) {
    // Confirmed SOL — existing proximity scoring
    const sd = dU(c.sol);
    if (sd < 0) score += 50;
    else if (sd <= 30) score += 40;
    else if (sd <= 60) score += 25;
  }
  const isLit = (c.status || "").includes("Litigation");
  const ld = litDetails || {};
  if (isLit && !hasFiledComplaint(c)) score += 20; // No filed complaint proof
  if (isLit && !ld.discovery_deadline && !c.ld?.discDeadline) score += 15;
  if (isLit && !ld.trial_date && !c.ld?.trialDate) score += 15;
  if (c.dop) {
    const daysOpen = Math.ceil((now - new Date(c.dop + "T00:00:00")) / 86400000);
    if (daysOpen > 180 && !(c.totalRec > 0)) score += 10;
    if ((c.status === "Intake" || c.status === "New") && daysOpen > 30) score += 10;
  }
  return Math.min(score, 100);
}

function riskColor(score) {
  if (score <= 20) return { bg: B.greenBg, t: B.green, label: "Low" };
  if (score <= 40) return { bg: B.goldBg, t: B.gold, label: "Medium" };
  if (score <= 60) return { bg: "rgba(235,140,3,0.12)", t: "#eb8c03", label: "High" };
  return { bg: B.dangerBg, t: B.danger, label: "Critical" };
}

function RiskBadge({ score }) {
  const rc = riskColor(score);
  return (
    <span style={{ ...S.badge, background: rc.bg, color: rc.t, border: `1px solid ${rc.t}30` }}>
      {score > 60 ? "🔴" : score > 40 ? "🟠" : score > 20 ? "🟡" : "🟢"} {score}
    </span>
  );
}

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
      docUrl: ld.doc_url,
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
// DOCUMENT BROWSER (Supabase Storage)
// ═══════════════════════════════════════════════════════════
function DocumentBrowser({ caseId, clientName }) {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (caseId) params.case_id = caseId;
      if (selectedCategory) params.category = selectedCategory;
      if (search) params.search = search;
      const qs = new URLSearchParams(params).toString();
      const resp = await fetch(`/api/docs?${qs}`);
      const data = await resp.json();
      if (data.error) { setError(data.error); return; }
      setDocuments(data.documents || []);
      // Extract unique categories
      const cats = {};
      (data.documents || []).forEach(d => { const c = d.category || "Uncategorized"; cats[c] = (cats[c] || 0) + 1; });
      setCategories(Object.entries(cats).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [caseId, selectedCategory, search]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const fileIcon = ext => {
    if (["pdf"].includes(ext)) return "📕";
    if (["doc", "docx"].includes(ext)) return "📘";
    if (["xls", "xlsx"].includes(ext)) return "📗";
    if (["jpg", "jpeg", "png", "gif", "webp", "tiff"].includes(ext)) return "🖼️";
    if (["msg", "eml"].includes(ext)) return "📧";
    return "📄";
  };

  const handleDownload = async (doc) => {
    try {
      const resp = await fetch(`/api/docs?id=${doc.id}`);
      const data = await resp.json();
      if (data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = doc.filename;
        a.target = "_blank";
        a.click();
      } else {
        toast.error("Could not generate download link");
      }
    } catch (err) { toast.error(err.message); }
  };

  const handleUpload = async (files, category) => {
    if (!caseId) { toast.error("Select a case first"); return; }
    setUploading(true);
    let uploaded = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("case_id", caseId);
        formData.append("category", category || selectedCategory || "Uncategorized");
        const resp = await fetch("/api/docs", { method: "POST", body: formData });
        const data = await resp.json();
        if (data.error) toast.error(`${file.name}: ${data.error}`);
        else uploaded++;
      } catch (err) { toast.error(`${file.name}: ${err.message}`); }
    }
    if (uploaded > 0) {
      toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? "s" : ""}`);
      fetchDocs();
    }
    setUploading(false);
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    try {
      const resp = await fetch(`/api/docs?id=${doc.id}`, { method: "DELETE" });
      const data = await resp.json();
      if (data.error) toast.error(data.error);
      else { toast.success("Deleted"); fetchDocs(); }
    } catch (err) { toast.error(err.message); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleUpload(files);
  };

  const filteredDocs = selectedCategory
    ? documents.filter(d => (d.category || "Uncategorized") === selectedCategory)
    : documents;

  const aiStatusBadge = (status) => {
    const colors = { pending: { bg: B.goldBg, c: B.gold }, processing: { bg: B.navyBg, c: "#5b8def" }, extracted: { bg: B.greenBg, c: B.green }, failed: { bg: B.dangerBg, c: B.danger } };
    const s = colors[status] || colors.pending;
    return <span style={{ ...S.badge, background: s.bg, color: s.c }}>{status}</span>;
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={dragOver ? { border: `2px dashed ${B.gold}`, borderRadius: 10, padding: 4 } : {}}
    >
      {/* Header with search and upload */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text" placeholder="Search documents..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, maxWidth: 300 }}
          />
        </div>
        {caseId && (
          <div style={{ display: "flex", gap: 8 }}>
            <input type="file" ref={fileInputRef} multiple style={{ display: "none" }}
              onChange={e => handleUpload(Array.from(e.target.files))} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ ...S.btn, opacity: uploading ? 0.5 : 1 }}>
              {uploading ? "Uploading..." : "📤 Upload"}
            </button>
          </div>
        )}
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <span onClick={() => setSelectedCategory(null)}
            style={{ ...S.badge, cursor: "pointer", background: !selectedCategory ? B.gold : "transparent", color: !selectedCategory ? "#000" : B.txtM, border: `1px solid ${!selectedCategory ? B.gold : B.bdr}` }}>
            All ({documents.length})
          </span>
          {categories.map(cat => (
            <span key={cat.name} onClick={() => setSelectedCategory(cat.name)}
              style={{ ...S.badge, cursor: "pointer", background: selectedCategory === cat.name ? B.gold : "transparent", color: selectedCategory === cat.name ? "#000" : B.txtM, border: `1px solid ${selectedCategory === cat.name ? B.gold : B.bdr}` }}>
              {cat.name} ({cat.count})
            </span>
          ))}
        </div>
      )}

      {loading && <div style={{ padding: 20, textAlign: "center", color: B.txtM }}>Loading documents...</div>}

      {/* Document table */}
      {!loading && filteredDocs.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>File</th>
              <th style={S.th}>Category</th>
              <th style={S.th}>Size</th>
              <th style={S.th}>Uploaded</th>
              <th style={S.th}>AI</th>
              <th style={{ ...S.th, width: 60 }}></th>
            </tr></thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr key={doc.id} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <td style={{ ...S.td, display: "flex", alignItems: "center", gap: 8 }}
                    onClick={() => handleDownload(doc)}>
                    <span>{fileIcon(doc.extension)}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.filename}</div>
                      {doc.original_path && <div style={{ fontSize: 11, color: B.txtD, marginTop: 2 }}>{doc.original_path}</div>}
                    </div>
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{doc.category || "—"}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.txtM }}>{fmtSize(doc.size_bytes)}</td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, color: B.txtM }}>{doc.uploaded_at ? fmtD(doc.uploaded_at.split("T")[0]) : "—"}</td>
                  <td style={S.td}>{aiStatusBadge(doc.ai_status)}</td>
                  <td style={S.td}>
                    <span onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                      style={{ cursor: "pointer", fontSize: 14, color: B.txtD, padding: "4px 8px" }}
                      title="Delete">🗑️</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredDocs.length === 0 && !error && (
        <div style={{ ...S.card, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, color: B.txtM }}>
            {caseId ? "No documents yet. Upload files or drag and drop." : "No documents found."}
          </div>
          {caseId && (
            <div style={{ fontSize: 12, color: B.txtD, marginTop: 8 }}>
              Supports PDF, Word, Excel, images, and more.
            </div>
          )}
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: B.card, border: `2px dashed ${B.gold}`, borderRadius: 16, padding: "40px 60px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: B.gold }}>Drop files to upload</div>
          </div>
        </div>
      )}

      {error && (
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
function Side({ user, active, onNav, onOut, onCmdK, mobileOpen, onToggleMobile, counts }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "⬡", count: null, dot: counts?.solAlerts > 0 },
    { id: "cases", label: "Cases", icon: "◈", count: counts?.cases },
    { id: "tasks", label: "Tasks", icon: "☐", count: counts?.tasks },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "docs", label: "Documents", icon: "◇" },
    { id: "reports", label: "Reports", icon: "📊" },
    { id: "compare", label: "Compare", icon: "⚖️" },
    { id: "intake", label: "New Case", icon: "➕" },
    { id: "templates", label: "Templates", icon: "📝" },
    { id: "contacts", label: "Contacts", icon: "👤" },
    { id: "activity", label: "Activity", icon: "📋" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "compliance", label: "Compliance", icon: "🛡️", dot: counts?.criticalCases > 0 },
  ];

  return (
    <div style={{ width: 220, minHeight: "100vh", background: B.card, borderRight: `1px solid ${B.bdr}`, display: "flex", flexDirection: "column" }}>
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
            {n.count != null && <span style={{ marginLeft: "auto", fontSize: 10, color: B.txtD, ...S.mono }}>{n.count}</span>}
            {n.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: B.danger, marginLeft: n.count != null ? 6 : "auto", flexShrink: 0 }} />}
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
      // Log task creation activity
      try { if (caseId) await api.createActivity({ case_id: caseId, type: "task", description: `Task created: ${form.title}`, user_id: userId }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
      setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal" });
      setShowForm(false);
      toast.success("Task created");
      loadTasks();
    } catch (err) { console.error("Failed to create task:", err); toast.error("Failed to create task"); }
    setSaving(false);
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await api.updateTask(task.id, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      // Log task status change activity
      try { if (task.case_id) await api.createActivity({ case_id: task.case_id, type: "task", description: newStatus === "completed" ? `Task completed: ${task.title}` : `Task reopened: ${task.title}`, user_id: userId }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
      toast.success(newStatus === "completed" ? "Task completed" : "Task reopened");
      loadTasks();
    } catch (err) { console.error("Failed to update task:", err); toast.error("Failed to update task"); }
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
  const my = useMemo(() => cases.filter(c => c.attorney?.id === user.id || c.support?.id === user.id), [cases, user.id]);
  const ac = useMemo(() => cases.filter(c => c.status !== "Settled" && c.status !== "Closed"), [cases]);
  const myActive = useMemo(() => my.filter(c => c.status !== "Settled" && c.status !== "Closed"), [my]);
  const sol90 = useMemo(() => ac.filter(c => c.sol && !solIsMet(c.status) && dU(c.sol) < 90), [ac]);
  const rec = useMemo(() => cases.reduce((s, c) => s + c.totalRec, 0), [cases]);
  const sc = useMemo(() => { const m = {}; ac.forEach(c => { m[c.status] = (m[c.status] || 0) + 1; }); return m; }, [ac]);
  const insurerCounts = useMemo(() => { const m = {}; ac.forEach(c => { if (c.insurer) m[c.insurer] = (m[c.insurer] || 0) + 1; }); return m; }, [ac]);
  const typeCounts = useMemo(() => { const m = {}; ac.forEach(c => { const t = c.type || "Other"; m[t] = (m[t] || 0) + 1; }); return m; }, [ac]);

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
          {ac.filter(c => c.sol && !solIsMet(c.status)).sort((a, b) => new Date(a.sol) - new Date(b.sol)).slice(0, 6).map(c => {
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

      {/* Loss Type Breakdown */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <h3 style={S.secT}>🔥 Cases by Loss Type</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, ct]) => (
            <div key={t} style={{ ...S.card, padding: "12px 20px", flex: "1 1 100px", textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{LOSS_ICON[t] || "❓"}</div>
              <div style={{ ...S.mono, fontSize: 20, fontWeight: 700, color: B.gold }}>{ct}</div>
              <div style={{ fontSize: 11, color: B.txtM, marginTop: 2 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insurer Breakdown */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <h3 style={S.secT}>🏢 Cases by Insurer <span style={{ fontSize: 11, color: B.txtD, fontWeight: 400 }}>({Object.keys(insurerCounts).length} insurers, {ac.length} active cases)</span></h3>
        {(() => {
          const sorted = Object.entries(insurerCounts).sort((a, b) => b[1] - a[1]);
          const maxCt = sorted[0]?.[1] || 1;
          const showAll = sorted.length <= 20;
          const displayed = showAll ? sorted : sorted.slice(0, 20);
          const rest = showAll ? [] : sorted.slice(20);
          const restTotal = rest.reduce((s, [, v]) => s + v, 0);
          return (<>
            {displayed.map(([ins, ct]) => (
              <div key={ins} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <div style={{ width: 180, fontSize: 11, color: B.txtM, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins}</div>
                <div style={{ flex: 1, height: 20, background: `${B.bdr}40`, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(ct / maxCt) * 100}%`, background: `${B.navy}60`, borderRadius: 4, borderRight: `3px solid ${B.gold}` }} />
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: B.gold, ...S.mono }}>{ct}</span>
                </div>
              </div>
            ))}
            {restTotal > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, paddingTop: 6, borderTop: `1px solid ${B.bdr}` }}>
                <div style={{ width: 180, fontSize: 11, color: B.txtD, textAlign: "right", fontStyle: "italic" }}>+{rest.length} others</div>
                <div style={{ flex: 1, height: 20, background: `${B.bdr}40`, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(restTotal / maxCt) * 100}%`, background: `${B.bdr}80`, borderRadius: 4 }} />
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: B.txtD, ...S.mono }}>{restTotal}</span>
                </div>
              </div>
            )}
          </>);
        })()}
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
function Cases({ user, cases, onOpen, initialStatus, initialFilters, onClearFilter, team, onBatchUpdate, onCaseCreated }) {
  const [search, setSearch] = useState("");
  const [fSt, setFSt] = useState(initialFilters?.status || initialStatus || "All");
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [fJ, setFJ] = useState(initialFilters?.jurisdiction || "All");
  const [fIns, setFIns] = useState(initialFilters?.insurer || "All");
  const [fAtt, setFAtt] = useState(initialFilters?.attorney || "All");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [fType, setFType] = useState(initialFilters?.type || "All");
  const [fDolFrom, setFDolFrom] = useState("");
  const [fDolTo, setFDolTo] = useState("");
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

  const insurers = useMemo(() => [...new Set(cases.map(c => c.insurer).filter(Boolean))].sort(), [cases]);
  const attorneys = useMemo(() => [...new Set(cases.map(c => c.attorney?.name).filter(Boolean))].sort(), [cases]);

  const hasFilters = fSt !== "All" || fJ !== "All" || fIns !== "All" || fAtt !== "All" || fType !== "All" || fDateFrom || fDateTo || fDolFrom || fDolTo || search;

  const clearFilters = () => {
    setFSt("All"); setFJ("All"); setFIns("All"); setFAtt("All"); setFType("All");
    setFDateFrom(""); setFDateTo(""); setFDolFrom(""); setFDolTo(""); setSearch(""); setAiResults(null); setPg(0);
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

  const pool = useMemo(() => scope === "mine" ? cases.filter(c => c.attorney?.id === user.id || c.support?.id === user.id) : cases, [cases, scope, user.id]);
  const fl = useMemo(() => pool.filter(c => {
    if (search && !aiResults) {
      const q = search.toLowerCase();
      if (!c.client?.toLowerCase().includes(q) && !c.ref?.toLowerCase().includes(q) && !c.insurer?.toLowerCase().includes(q)
        && !(c.attorney?.name || "").toLowerCase().includes(q)) return false;
    }
    if (fSt !== "All" && c.status !== fSt) return false;
    if (fJ !== "All" && c.juris !== fJ) return false;
    if (fIns !== "All" && c.insurer !== fIns) return false;
    if (fAtt !== "All" && c.attorney?.name !== fAtt) return false;
    if (fType !== "All" && c.type !== fType) return false;
    if (fDateFrom && c.dop && c.dop < fDateFrom) return false;
    if (fDateTo && c.dop && c.dop > fDateTo) return false;
    if (fDolFrom && c.dol && c.dol < fDolFrom) return false;
    if (fDolTo && c.dol && c.dol > fDolTo) return false;
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
  }), [pool, search, aiResults, fSt, fJ, fIns, fAtt, fType, fDateFrom, fDateTo, fDolFrom, fDolTo, sBy, sDir]);

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
        <button onClick={() => setNewCaseOpen(true)} style={{ ...S.btn, fontSize: 11, padding: "6px 14px", marginLeft: "auto" }}>➕ New Case</button>
        <button onClick={() => { exportCasesToCSV(displayCases, `cases-${new Date().toISOString().split("T")[0]}.csv`); toast.success(`Exported ${displayCases.length} cases to CSV`); }} style={{ ...S.btnO, fontSize: 11, padding: "6px 12px" }}>📥 Export CSV</button>
        <div style={{ fontSize: 13, color: B.txtM }}>
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
          <select value={fType} onChange={e => { setFType(e.target.value); setPg(0); }} style={{ ...S.input, width: 120, flex: "0 0 auto" }}>
            <option value="All">All Types</option>
            {LOSS_TYPES.map(x => <option key={x} value={x}>{LOSS_ICON[x]} {x}</option>)}
          </select>
        </div>
        {/* Date range row */}
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Opened</span>
          <input type="date" value={fDateFrom} onChange={e => { setFDateFrom(e.target.value); setPg(0); }} style={{ ...S.input, width: 150 }} placeholder="From" />
          <span style={{ fontSize: 11, color: B.txtD }}>to</span>
          <input type="date" value={fDateTo} onChange={e => { setFDateTo(e.target.value); setPg(0); }} style={{ ...S.input, width: 150 }} placeholder="To" />
          <span style={{ fontSize: 11, color: B.txtD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 8 }}>DOL</span>
          <input type="date" value={fDolFrom} onChange={e => { setFDolFrom(e.target.value); setPg(0); }} style={{ ...S.input, width: 150 }} placeholder="From" />
          <span style={{ fontSize: 11, color: B.txtD }}>to</span>
          <input type="date" value={fDolTo} onChange={e => { setFDolTo(e.target.value); setPg(0); }} style={{ ...S.input, width: 150 }} placeholder="To" />
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
            {[["ref", "Case #"], ["client", "Client"], ["type", "Type"], ["status", "Status"], ["insurer", "Insurer"], ["attorney", "Attorney"], ["juris", "State"], ["dop", "Opened"], ["sol", "SOL"], ["risk", "Risk"], ["lastAct", "Last Activity"]].map(([c, l]) => (
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
                  <td style={{ ...S.td, fontSize: 12, whiteSpace: "nowrap" }}>{LOSS_ICON[c.type] || "❓"} {c.type || "—"}</td>
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
                  <td style={{ ...S.td, ...S.mono, fontSize: 12, fontWeight: 600, color: sd != null ? (sd < 30 ? B.danger : sd < 90 ? B.gold : B.txtM) : B.txtD }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{c.sol ? fmtD(c.sol) : "—"}{solBadge(c.sol, c.status, c)}</div>
                  </td>
                  <td style={S.td}><RiskBadge score={calcRiskScore(c, {})} /></td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 11, color: B.txtD }}>{getLastActivity(c)}</td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr><td colSpan={12} style={{ ...S.td, textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: B.txtM, marginBottom: 6 }}>No cases match your filters</div>
                <div style={{ fontSize: 12, color: B.txtD, marginBottom: 16 }}>Try adjusting your search or filter criteria</div>
                {hasFilters && <button onClick={clearFilters} style={{ ...S.btn, fontSize: 12 }}>✕ Clear All Filters</button>}
              </td></tr>
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
      <NewCaseModal open={newCaseOpen} onClose={() => setNewCaseOpen(false)} cases={cases} team={team} onCreated={onCaseCreated} />
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
// COMPREHENSIVE ACTIVITY FEED (fetches from all sources)
// ═══════════════════════════════════════════════════════════
const TYPE_COLORS = {
  note: "#6c757d", call: "#386f4a", email: "#4a90d9", task: "#ff8c00",
  document: "#20b2aa", negotiation: "#ebb003", pleading: "#e74c3c",
  estimate: "#7b68ee", status_change: "#17a2b8", deadline: "#dc3545",
};

function ComprehensiveActivityFeed({ caseId }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/cases/${caseId}/activity`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setFeed(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [caseId]);

  const filtered = feed
    .filter(a => filter === "all" || a.type === filter)
    .sort((a, b) => sortDir === "desc" ? new Date(b.date || 0) - new Date(a.date || 0) : new Date(a.date || 0) - new Date(b.date || 0));

  const typeCounts = {};
  feed.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
  const types = Object.keys(typeCounts).sort();

  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      const now = new Date();
      const diff = now - dt;
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: dt.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
    } catch { return d; }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      Loading activity feed...
    </div>
  );

  return (
    <div>
      {/* Summary chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setFilter("all")} style={{
          padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === "all" ? B.gold : B.bdr}`,
          background: filter === "all" ? B.gold + "22" : "transparent", color: filter === "all" ? B.gold : B.txtM,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>All ({feed.length})</button>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: "5px 12px", borderRadius: 20, border: `1px solid ${filter === t ? (TYPE_COLORS[t] || B.gold) : B.bdr}`,
            background: filter === t ? (TYPE_COLORS[t] || B.gold) + "22" : "transparent",
            color: filter === t ? (TYPE_COLORS[t] || B.gold) : B.txtD,
            fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>{aIcon(t)}</span>
            <span>{t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
            <span style={{ opacity: 0.7 }}>({typeCounts[t]})</span>
          </button>
        ))}
        <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")} style={{ ...S.btnO, fontSize: 11, padding: "5px 12px", marginLeft: "auto" }}>
          {sortDir === "desc" ? "Newest ↓" : "Oldest ↑"}
        </button>
      </div>

      {/* Feed */}
      <div style={{ ...S.card, padding: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: B.txtD }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            No activity {filter !== "all" ? "matching filter" : "yet"}
          </div>
        ) : filtered.map((a, i) => {
          const clr = TYPE_COLORS[a.type] || "#888";
          return (
            <div key={a.id || i} style={{
              display: "flex", gap: 14, padding: "14px 20px",
              borderBottom: i < filtered.length - 1 ? `1px solid ${B.bdr}15` : "none",
              borderLeft: `3px solid ${clr}`,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = B.bdr + "20"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: a.actorClr || clr,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>{a.icon || aIcon(a.type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                    color: clr, background: clr + "18", padding: "2px 8px", borderRadius: 10,
                  }}>{a.type?.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: B.txt }}>{a.title}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: B.txtD, ...S.mono, flexShrink: 0 }}>{fmtDate(a.date)}</span>
                </div>
                {a.desc && <div style={{ fontSize: 12, color: B.txtM, marginTop: 2, lineHeight: 1.5 }}>{a.desc}</div>}
                {a.actor && <div style={{ fontSize: 10, color: B.txtD, marginTop: 4 }}>by {a.actor}</div>}
              </div>
            </div>
          );
        })}
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
// WORKFLOW STEPPER
// ═══════════════════════════════════════════════════════════
function WorkflowStepper({ currentStatus, onAdvance }) {
  const [confirmStage, setConfirmStage] = useState(null);
  const getActiveIdx = () => {
    for (let i = WORKFLOW_STAGES.length - 1; i >= 0; i--) {
      if (currentStatus?.startsWith(WORKFLOW_STAGES[i].key) || currentStatus === WORKFLOW_STAGES[i].key) return i;
    }
    if (currentStatus?.includes("Litigation")) return 5;
    return 0;
  };
  const activeIdx = getActiveIdx();

  return (
    <div style={{ ...S.card, marginBottom: 16, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Case Workflow</div>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {WORKFLOW_STAGES.map((stage, idx) => {
          const isActive = idx === activeIdx;
          const isPast = idx < activeIdx;
          const isFuture = idx > activeIdx;
          const isLast = idx === WORKFLOW_STAGES.length - 1;
          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
              <div
                onClick={() => isFuture && setConfirmStage({ stage, idx })}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  cursor: isFuture ? "pointer" : "default", zIndex: 1,
                  opacity: isFuture ? 0.5 : 1, transition: "opacity 0.2s",
                }}
                onMouseEnter={e => { if (isFuture) e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={e => { if (isFuture) e.currentTarget.style.opacity = "0.5"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: isActive ? B.gold : isPast ? B.green : B.bdr,
                  border: `2px solid ${isActive ? B.gold : isPast ? B.green : B.bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: isActive || isPast ? "#fff" : B.txtD,
                  boxShadow: isActive ? `0 0 12px ${B.gold}40` : "none",
                }}>
                  {isPast ? "✓" : stage.icon}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: isActive ? 700 : 500,
                  color: isActive ? B.gold : isPast ? B.green : B.txtD,
                  textAlign: "center", whiteSpace: "nowrap",
                }}>{stage.label}</span>
              </div>
              {!isLast && (
                <div style={{ flex: 1, height: 2, minWidth: 8, background: idx < activeIdx ? B.green : B.bdr, margin: "0 2px", marginBottom: 18 }} />
              )}
            </div>
          );
        })}
      </div>
      {confirmStage && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: B.goldBg, border: `1px solid ${B.gold}30`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: B.gold }}>Advance to <strong>{confirmStage.stage.label}</strong>?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmStage(null)} style={{ ...S.btnO, fontSize: 11, padding: "4px 12px" }}>Cancel</button>
            <button onClick={() => { onAdvance(confirmStage.stage.key); setConfirmStage(null); }} style={{ ...S.btn, fontSize: 11, padding: "4px 12px" }}>Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INSURER AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════
function InsurerAutocomplete({ value, onChange, cases }) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const insurers = [...new Set((cases || []).map(c => c.insurer).filter(Boolean))].sort();
  const filtered = value ? insurers.filter(i => i.toLowerCase().includes(value.toLowerCase())) : insurers;

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setFocused(false); }, 150)}
        style={S.input} placeholder="Start typing insurer..."
      />
      {open && focused && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 6,
          maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {filtered.slice(0, 15).map(ins => (
            <div key={ins}
              onMouseDown={e => { e.preventDefault(); onChange(ins); setOpen(false); }}
              style={{ padding: "8px 12px", fontSize: 12, color: B.txt, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = B.cardH}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {ins}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NEW CASE MODAL
// ═══════════════════════════════════════════════════════════
function NewCaseModal({ open, onClose, cases, team, onCreated }) {
  const [form, setForm] = useState({ client_name: "", type: "Property Casualty", jurisdiction: "", insurer: "", date_of_loss: "", attorney_id: "" });
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState([]);

  useEffect(() => {
    if (open) { setForm({ client_name: "", type: "Property Casualty", jurisdiction: "", insurer: "", date_of_loss: "", attorney_id: "" }); setDuplicates([]); }
  }, [open]);

  useEffect(() => {
    const name = form.client_name.trim().toLowerCase();
    if (name.length < 3) { setDuplicates([]); return; }
    setDuplicates((cases || []).filter(c => c.client?.toLowerCase().includes(name) || name.includes(c.client?.toLowerCase() || "~~~")).slice(0, 5));
  }, [form.client_name, cases]);

  const generateRef = () => {
    const yr = new Date().getFullYear().toString().slice(-2);
    const nums = (cases || []).map(c => c.ref).filter(r => r?.startsWith(`DC-${yr}`)).map(r => parseInt(r.split("-")[2]) || 0);
    return `DC-${yr}-${(Math.max(0, ...nums) + 1).toString().padStart(4, "0")}`;
  };

  const handleSubmit = async () => {
    if (!form.client_name.trim() || !form.jurisdiction) { toast.error("Client name and jurisdiction are required"); return; }
    setSaving(true);
    try {
      const ref = generateRef();
      const caseData = { ref, client_name: form.client_name.trim(), type: form.type, jurisdiction: form.jurisdiction, status: "Intake", date_opened: new Date().toISOString().split("T")[0] };
      if (form.insurer) caseData.insurer = form.insurer;
      if (form.date_of_loss) caseData.date_of_loss = form.date_of_loss;
      if (form.attorney_id) caseData.attorney_id = form.attorney_id;
      const row = await api.createCase(caseData);
      // Log case creation activity
      try { await api.createActivity({ case_id: row.id, type: "creation", description: `Case created: ${ref} — ${form.client_name.trim()}` }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
      toast.success(`Case ${ref} created`);
      if (onCreated) onCreated(row);
      onClose();
    } catch (err) { toast.error("Failed: " + err.message); }
    setSaving(false);
  };

  if (!open) return null;
  const attorneys = (team || []).filter(m => m.role === "Attorney" || m.title?.includes("Attorney"));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: 520, background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${B.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: B.gold }}>➕ New Case</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: B.txtD, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          {duplicates.length > 0 && (
            <div style={{ padding: "10px 14px", marginBottom: 16, borderRadius: 8, background: B.goldBg, border: `1px solid ${B.gold}30` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: B.gold, marginBottom: 6 }}>⚠️ Possible duplicates:</div>
              {duplicates.map(d => <div key={d.id} style={{ fontSize: 11, color: B.txtM, padding: "2px 0" }}><span style={{ ...S.mono, color: B.gold }}>{d.ref}</span> — {d.client} ({d.status})</div>)}
            </div>
          )}
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Client Name *</div>
              <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} style={S.input} placeholder="Full client name" autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Type *</div>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={S.input}>
                  <option value="Property Casualty">Property Casualty</option>
                  <option value="First Party Property">First Party Property</option>
                  <option value="Bad Faith">Bad Faith</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Jurisdiction *</div>
                <select value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} style={S.input}>
                  <option value="">Select state...</option>
                  {JURIS.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Insurer</div>
              <InsurerAutocomplete value={form.insurer} onChange={v => setForm({ ...form, insurer: v })} cases={cases} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Date of Loss</div>
                <input type="date" value={form.date_of_loss} onChange={e => setForm({ ...form, date_of_loss: e.target.value })} style={S.input} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Attorney</div>
                <select value={form.attorney_id} onChange={e => setForm({ ...form, attorney_id: e.target.value })} style={S.input}>
                  <option value="">Unassigned</option>
                  {attorneys.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${B.bdr}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={S.btnO}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>{saving ? "Creating..." : "Create Case"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GLOBAL HEADER BAR
// ═══════════════════════════════════════════════════════════
function GlobalHeader({ user, page, selCase, solCases, allCases, onOpenCase, onCmdK, criticalCount, onNavCompliance }) {
  const [solOpen, setSolOpen] = useState(false);
  const breadcrumbs = [{ label: "Dashboard" }];
  if (page === "cases" || page === "caseDetail") breadcrumbs.push({ label: "Cases" });
  if (page === "caseDetail" && selCase) breadcrumbs.push({ label: selCase.client });
  if (page === "calendar") breadcrumbs.push({ label: "Calendar" });
  if (page === "tasks") breadcrumbs.push({ label: "Tasks" });
  if (page === "docs") breadcrumbs.push({ label: "Documents" });
  if (page === "compliance") breadcrumbs.push({ label: "Compliance" });
  const solCritical = (solCases || []).filter(c => c._solDays <= 30);

  return (
    <div>
      {criticalCount > 0 && page !== "compliance" && (
        <div onClick={onNavCompliance} style={{ padding: "8px 16px", marginBottom: 12, borderRadius: 8, background: B.dangerBg, border: `1px solid ${B.danger}40`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: B.danger }}>
          ⚠️ {criticalCount} case{criticalCount !== 1 ? "s" : ""} need{criticalCount === 1 ? "s" : ""} immediate attention
          <span style={{ marginLeft: "auto", fontSize: 11, color: B.danger, opacity: 0.7 }}>View Compliance →</span>
        </div>
      )}
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", marginBottom: 20, borderBottom: `1px solid ${B.bdr}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: user?.clr || B.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{user?.ini || "?"}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: B.txt }}>{user?.name?.split(" ")[0] || ""}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: B.txtD }}>
        {breadcrumbs.map((b, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span>›</span>}
            <span style={{ color: i === breadcrumbs.length - 1 ? B.txt : B.txtM, fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}>{b.label}</span>
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <GlobalSearchNew onSelect={(caseId) => { const c = (allCases || []).find(x => x.id === caseId); if (c) onOpenCase(c); }} />
      <AlertsPanelNew onNavigate={(caseId) => { const c = (allCases || []).find(x => x.id === caseId); if (c) onOpenCase(c); }} />
      {(solCases || []).length > 0 && (
        <div style={{ position: "relative" }}>
          <div onClick={() => setSolOpen(o => !o)} role="button" aria-label="SOL alerts" style={{ width: 32, height: 32, borderRadius: "50%", background: solCritical.length > 0 ? B.dangerBg : B.goldBg, border: `1px solid ${solCritical.length > 0 ? B.danger : B.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
            <span style={{ fontSize: 14 }}>🔔</span>
            <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: solCritical.length > 0 ? B.danger : B.gold, color: "#000", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{(solCases || []).length}</span>
          </div>
          {solOpen && (
            <div style={{ position: "absolute", top: 40, right: 0, width: 360, maxHeight: 400, overflowY: "auto", background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 100 }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${B.bdr}`, fontSize: 13, fontWeight: 700 }}>🚨 SOL Alerts</div>
              {(solCases || []).map(c => (
                <div key={c.id} onClick={() => { onOpenCase(c); setSolOpen(false); }}
                  style={{ padding: "8px 14px", borderBottom: `1px solid ${B.bdr}06`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div><div style={{ fontSize: 12, fontWeight: 500 }}>{c.client}</div><div style={{ fontSize: 10, color: B.txtD }}>{c.ref}</div></div>
                  {solBadge(c.sol, c.status, c)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPLIANCE DASHBOARD
// ═══════════════════════════════════════════════════════════
function ComplianceDash({ cases, onOpen }) {
  const [filter, setFilter] = useState("all"); // all, critical, high, sol, communication, litigation

  const now = new Date();
  const caseData = useMemo(() => cases.map(c => {
    const score = calcRiskScore(c, {});
    const sd = c.sol ? dU(c.sol) : null;
    const daysOpen = c.dop ? Math.ceil((now - new Date(c.dop + "T00:00:00")) / 86400000) : 0;
    const isLit = (c.status || "").includes("Litigation");
    return { ...c, _risk: score, _solDays: sd, _daysOpen: daysOpen, _isLit: isLit };
  }), [cases]);

  const critical = caseData.filter(c => c._risk > 60);
  const high = caseData.filter(c => c._risk > 40 && c._risk <= 60);
  const solIssues = caseData.filter(c => c._solDays !== null && !solIsMet(c.status) && c._solDays <= 90);
  const commIssues = caseData.filter(c =>
    ((c.status === "Intake" || c.status === "New") && c._daysOpen > 30) ||
    (c.status === "Presuit Demand" && c._daysOpen > 90)
  );
  const litMissing = caseData.filter(c => c._isLit);
  const litNoComplaint = caseData.filter(c => c._isLit && !hasFiledComplaint(c));

  // SOL Needs Review: not_set or auto-estimated
  const solNeedsReview = caseData.filter(c => {
    const conf = solConfirmationStatus(c);
    return conf.status === "not_set" || conf.status === "auto";
  }).map(c => ({ ...c, _solConf: solConfirmationStatus(c) }))
    .sort((a, b) => {
      // not_set first, then auto
      if (a._solConf.status !== b._solConf.status) return a._solConf.status === "not_set" ? -1 : 1;
      // Then by proximity (cases closer to floor/SOL first)
      const aDate = a.sol || autoEstimateSol(a.dol);
      const bDate = b.sol || autoEstimateSol(b.dol);
      if (aDate && bDate) return dU(aDate) - dU(bDate);
      return aDate ? -1 : 1;
    });

  const filtered = filter === "critical" ? critical : filter === "high" ? high : filter === "sol" ? solIssues : filter === "communication" ? commIssues : filter === "litigation" ? litMissing : filter === "nocomplaint" ? litNoComplaint : filter === "solreview" ? solNeedsReview : caseData.filter(c => c._risk > 0);

  const summaryCards = [
    { label: "Critical", count: critical.length, icon: "🔴", bg: B.dangerBg, t: B.danger, f: "critical" },
    { label: "High Risk", count: high.length, icon: "🟠", bg: "rgba(235,140,3,0.12)", t: "#eb8c03", f: "high" },
    { label: "SOL Review", count: solNeedsReview.length, icon: "🔍", bg: "rgba(235,176,3,0.15)", t: "#e0a050", f: "solreview" },
    { label: "SOL Alerts", count: solIssues.length, icon: "⏰", bg: B.goldBg, t: B.gold, f: "sol" },
    { label: "No Complaint", count: litNoComplaint.length, icon: "📋", bg: "rgba(255,64,96,0.12)", t: "#ff4060", f: "nocomplaint" },
    { label: "Comm. Flags", count: commIssues.length, icon: "📞", bg: B.navyBg, t: "#6b6bff", f: "communication" },
    { label: "Litigation Gaps", count: litMissing.filter(c => c._risk >= 15).length, icon: "⚖️", bg: "rgba(124,92,191,0.12)", t: B.purple, f: "litigation" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🛡️ Compliance Dashboard</h2>
        <span style={{ fontSize: 12, color: B.txtD }}>Malpractice Prevention & Risk Tracking</span>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 24 }}>
        {summaryCards.map(s => (
          <div key={s.f} onClick={() => setFilter(f => f === s.f ? "all" : s.f)}
            style={{ ...S.card, padding: 16, cursor: "pointer", borderColor: filter === s.f ? s.t + "60" : B.bdr, textAlign: "center", transition: "border-color 0.15s" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.t, ...S.mono }}>{s.count}</div>
            <div style={{ fontSize: 11, color: B.txtM, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* SOL Needs Review */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.secT}>🔍 SOL Needs Review — Human Confirmation Required</div>
        {solNeedsReview.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: B.green, fontSize: 13 }}>✅ All cases have confirmed SOL dates</div>
        ) : (
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Status</th><th style={S.th}>SOL Status</th><th style={S.th}>SOL / Estimate</th><th style={S.th}>Days Since Intake</th><th style={S.th}>Risk</th>
            </tr></thead>
            <tbody>
              {solNeedsReview.map(c => {
                const estSol = c.sol || autoEstimateSol(c.dol);
                const estDays = estSol ? dU(estSol) : null;
                return (
                  <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={S.td}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.client}</div><div style={{ fontSize: 11, color: B.txtD, ...S.mono }}>{c.ref}</div></td>
                    <td style={S.td}><span style={{ ...S.badge, ...stClr(c.status), background: stClr(c.status).bg, color: stClr(c.status).t }}>{c.status}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: c._solConf.status === "not_set" ? B.dangerBg : B.goldBg, color: c._solConf.color, fontSize: 10 }}>
                        {c._solConf.status === "not_set" ? "🔴 Not Set" : "🟡 Unconfirmed"}
                      </span>
                    </td>
                    <td style={{ ...S.td, ...S.mono, fontSize: 12, color: c._solConf.status === "not_set" ? B.txtD : B.txtM }}>
                      {c.sol ? fmtD(c.sol) : estSol ? <span style={{ opacity: 0.5 }}>~{fmtD(estSol)}</span> : "—"}
                      {estDays !== null && <span style={{ marginLeft: 6, fontSize: 10, color: estDays <= 30 ? B.danger : estDays <= 90 ? B.gold : B.txtD }}>({estDays}d)</span>}
                    </td>
                    <td style={{ ...S.td, ...S.mono, fontWeight: 600 }}>{c._daysOpen}d</td>
                    <td style={S.td}><RiskBadge score={c._risk} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SOL Timeline */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.secT}>⏰ Statute of Limitations Tracker</div>
        {solIssues.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: B.green, fontSize: 13 }}>✅ All SOL deadlines are met or beyond 90 days</div>
        ) : (
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Status</th><th style={S.th}>SOL Date</th><th style={S.th}>Days Left</th><th style={S.th}>Risk</th>
            </tr></thead>
            <tbody>
              {solIssues.sort((a, b) => a._solDays - b._solDays).map(c => {
                const clr = c._solDays < 0 ? B.danger : c._solDays <= 30 ? B.danger : c._solDays <= 60 ? B.gold : "#eb8c03";
                return (
                  <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={S.td}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.client}</div><div style={{ fontSize: 11, color: B.txtD, ...S.mono }}>{c.ref}</div></td>
                    <td style={S.td}><span style={{ ...S.badge, ...stClr(c.status), background: stClr(c.status).bg, color: stClr(c.status).t }}>{c.status}</span></td>
                    <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{fmtD(c.sol)}</td>
                    <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: clr }}>{c._solDays < 0 ? `EXPIRED ${Math.abs(c._solDays)}d` : `${c._solDays}d`}</td>
                    <td style={S.td}><RiskBadge score={c._risk} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Client Communication Flags */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.secT}>📞 Client Communication Flags</div>
        {commIssues.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: B.green, fontSize: 13 }}>✅ No communication concerns detected</div>
        ) : (
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Status</th><th style={S.th}>Days Open</th><th style={S.th}>Concern</th><th style={S.th}>Risk</th>
            </tr></thead>
            <tbody>
              {commIssues.sort((a, b) => b._daysOpen - a._daysOpen).map(c => {
                const concern = (c.status === "Intake" || c.status === "New") ? "Intake stalled >30 days" : "Presuit Demand >90 days";
                return (
                  <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={S.td}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.client}</div><div style={{ fontSize: 11, color: B.txtD, ...S.mono }}>{c.ref}</div></td>
                    <td style={S.td}><span style={{ ...S.badge, ...stClr(c.status), background: stClr(c.status).bg, color: stClr(c.status).t }}>{c.status}</span></td>
                    <td style={{ ...S.td, ...S.mono, fontWeight: 600 }}>{c._daysOpen}d</td>
                    <td style={{ ...S.td, fontSize: 12, color: B.gold }}>{concern}</td>
                    <td style={S.td}><RiskBadge score={c._risk} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Litigation Missing Filed Complaint */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.secT}>📋 Litigation Cases Missing Filed Complaint</div>
        <div style={{ fontSize: 12, color: B.txtM, marginBottom: 12 }}>Cases in litigation without proof of filed complaint. SOL cannot be confirmed as met without a complaint on file.</div>
        {litNoComplaint.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: B.green, fontSize: 13 }}>✅ All litigation cases have filed complaints</div>
        ) : (
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Status</th><th style={S.th}>SOL</th><th style={S.th}>Attorney</th><th style={S.th}>Risk</th>
            </tr></thead>
            <tbody>
              {litNoComplaint.sort((a, b) => b._risk - a._risk).map(c => (
                <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={S.td}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.client}</div><div style={{ fontSize: 11, color: B.txtD, ...S.mono }}>{c.ref}</div></td>
                  <td style={S.td}><span style={{ ...S.badge, ...stClr(c.status), background: stClr(c.status).bg, color: stClr(c.status).t }}>{c.status}</span></td>
                  <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{c.sol ? fmtD(c.sol) : "—"}</td>
                  <td style={{ ...S.td, fontSize: 12 }}>{c.attorney?.name || "—"}</td>
                  <td style={S.td}><RiskBadge score={c._risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Litigation Missing Deadlines */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.secT}>⚖️ Litigation Cases — Scheduling Order Compliance</div>
        <div style={{ fontSize: 12, color: B.txtM, marginBottom: 12 }}>Cases in litigation without discovery deadlines, trial dates, or mediation dates set. Add deadlines in the case detail Litigation tab.</div>
        {litMissing.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: B.green, fontSize: 13 }}>✅ No litigation cases found</div>
        ) : (
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Status</th><th style={S.th}>Days in Litigation</th><th style={S.th}>Missing Dates</th><th style={S.th}>Risk</th>
            </tr></thead>
            <tbody>
              {litMissing.sort((a, b) => b._risk - a._risk).map(c => (
                <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={S.td}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.client}</div><div style={{ fontSize: 11, color: B.txtD, ...S.mono }}>{c.ref}</div></td>
                  <td style={S.td}><span style={{ ...S.badge, ...stClr(c.status), background: stClr(c.status).bg, color: stClr(c.status).t }}>{c.status}</span></td>
                  <td style={{ ...S.td, ...S.mono }}>{c._daysOpen}d</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <span style={{ ...S.badge, fontSize: 10, background: B.dangerBg, color: B.danger }}>Discovery</span>
                      <span style={{ ...S.badge, fontSize: 10, background: B.dangerBg, color: B.danger }}>Trial</span>
                      <span style={{ ...S.badge, fontSize: 10, background: B.dangerBg, color: B.danger }}>Mediation</span>
                    </div>
                  </td>
                  <td style={S.td}><RiskBadge score={c._risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Full Risk Table */}
      {filter !== "all" && filtered.length > 0 && filter !== "sol" && filter !== "communication" && filter !== "litigation" && (
        <div style={{ ...S.card }}>
          <div style={S.secT}>{filter === "critical" ? "🔴 Critical Cases" : "🟠 High Risk Cases"}</div>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Status</th><th style={S.th}>SOL</th><th style={S.th}>Days Open</th><th style={S.th}>Risk</th>
            </tr></thead>
            <tbody>
              {filtered.sort((a, b) => b._risk - a._risk).map(c => (
                <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={S.td}><div style={{ fontWeight: 600 }}>{c.client}</div><div style={{ fontSize: 11, color: B.txtD, ...S.mono }}>{c.ref}</div></td>
                  <td style={S.td}><span style={{ ...S.badge, ...stClr(c.status), background: stClr(c.status).bg, color: stClr(c.status).t }}>{c.status}</span></td>
                  <td style={S.td}>{c.sol ? <>{fmtD(c.sol)} {solBadge(c.sol, c.status, c)}</> : "—"}</td>
                  <td style={{ ...S.td, ...S.mono }}>{c._daysOpen}d</td>
                  <td style={S.td}><RiskBadge score={c._risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CASE DETAIL - COMPLIANCE TAB
// ═══════════════════════════════════════════════════════════
function FiledComplaintSection({ c, onCaseUpdate }) {
  const [filedDate, setFiledDate] = useState(c.ld?.filedDate || "");
  const [caseNum, setCaseNum] = useState(c.ld?.caseNum || "");
  const [court, setCourt] = useState(c.ld?.court || "");
  const [docUrl, setDocUrl] = useState(c.ld?.docUrl || "");
  const [saving, setSaving] = useState(false);
  const hasFiled = hasFiledComplaint(c);

  const handleSave = async () => {
    if (!filedDate && !docUrl) { toast.error("Please enter a filed date or document link"); return; }
    setSaving(true);
    try {
      await api.upsertLitigationDetails(c.id, {
        filed_date: filedDate || null,
        case_number: caseNum || null,
        court: court || null,
        doc_url: docUrl || null,
      });
      toast.success("Complaint info saved");
      const updLd = { ...c.ld, filedDate: filedDate || c.ld?.filedDate, caseNum: caseNum || c.ld?.caseNum, court: court || c.ld?.court, docUrl: docUrl || c.ld?.docUrl };
      if (onCaseUpdate) onCaseUpdate({ ...c, ld: updLd });
    } catch (e) { toast.error("Failed to save: " + e.message); }
    setSaving(false);
  };

  return (
    <div style={{ ...S.card, marginBottom: 20, borderColor: hasFiled ? B.green + "40" : B.danger + "40" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={S.secT}>📋 Filed Complaint</div>
        <span style={{ ...S.badge, background: hasFiled ? B.greenBg : B.dangerBg, color: hasFiled ? B.green : B.danger, fontSize: 11 }}>
          {hasFiled ? "✅ On File" : "⚠️ Missing"}
        </span>
      </div>
      {hasFiled ? (
        <div>
          <div style={{ padding: 12, borderRadius: 8, background: B.greenBg, border: `1px solid ${B.green}20`, fontSize: 13, color: B.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            ✅ Complaint filed {c.ld?.filedDate ? fmtD(c.ld.filedDate) : ""}{c.ld?.caseNum ? ` — ${c.ld.caseNum}` : ""}{c.ld?.court ? ` — ${c.ld.court}` : ""}
            {c.ld?.docUrl && <a href={c.ld.docUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#5b8def", fontSize: 12, textDecoration: "underline" }}>View Document</a>}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ padding: 12, borderRadius: 8, background: B.dangerBg, border: `1px solid ${B.danger}20`, marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: B.danger, fontWeight: 600 }}>⚠️ No filed complaint on file.</span>
            <span style={{ color: B.txtM }}> SOL cannot be confirmed as met without proof of filing.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>Filed Date</div>
              <input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} style={{ ...S.input, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>Case Number</div>
              <input type="text" value={caseNum} onChange={e => setCaseNum(e.target.value)} placeholder="e.g. 2024-CV-12345" style={{ ...S.input, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>Court</div>
              <input type="text" value={court} onChange={e => setCourt(e.target.value)} placeholder="e.g. Harris County District Court" style={{ ...S.input, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>Document Link/URL</div>
              <input type="text" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://..." style={{ ...S.input, width: "100%" }} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save Complaint Info"}
          </button>
        </div>
      )}
    </div>
  );
}

function ComplianceTab({ c, onCaseUpdate }) {
  const score = calcRiskScore(c, {});
  const rc = riskColor(score);
  const sd = c.sol ? dU(c.sol) : null;
  const isLit = (c.status || "").includes("Litigation");
  const daysOpen = c.dop ? Math.ceil((new Date() - new Date(c.dop + "T00:00:00")) / 86400000) : 0;
  const conf = solConfirmationStatus(c);
  const estimatedSol = autoEstimateSol(c.dol);
  const [solDate, setSolDate] = useState(c.sol || estimatedSol || "");
  const [solSaving, setSolSaving] = useState(false);
  const [solEditing, setSolEditing] = useState(false);

  const handleConfirmSol = async () => {
    if (!solDate) { toast.error("Please select a SOL date"); return; }
    setSolSaving(true);
    try {
      await api.updateCase(c.id, { statute_of_limitations: solDate });
      // Log SOL date update
      try { await api.createActivity({ case_id: c.id, type: "sol_update", description: `SOL date updated to ${solDate}` }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
      toast.success("SOL date confirmed and saved");
      if (onCaseUpdate) onCaseUpdate({ ...c, sol: solDate });
      setSolEditing(false);
    } catch (e) { toast.error("Failed to save SOL: " + e.message); }
    setSolSaving(false);
  };

  const breakdown = [];
  if (conf.status === "not_set") {
    breakdown.push({ label: "SOL Not Set — Critical Risk", pts: 30, color: B.danger });
    if (estimatedSol) {
      const floorDays = dU(estimatedSol);
      if (floorDays < 0) breakdown.push({ label: `1-year floor PASSED ${Math.abs(floorDays)}d ago`, pts: 20, color: B.danger });
      else if (floorDays <= 30) breakdown.push({ label: `1-year floor in ${floorDays}d`, pts: 15, color: B.danger });
      else if (floorDays <= 60) breakdown.push({ label: `1-year floor in ${floorDays}d`, pts: 10, color: B.gold });
    }
  } else if (conf.status === "auto") {
    breakdown.push({ label: "SOL Auto-Estimated — Needs Confirmation", pts: 15, color: B.gold });
    if (c.sol && !solIsMet(c.status)) {
      if (sd < 0) breakdown.push({ label: "SOL Expired — NOT MET", pts: 50, color: B.danger });
      else if (sd <= 30) breakdown.push({ label: `SOL in ${sd} days — NOT MET`, pts: 40, color: B.danger });
      else if (sd <= 60) breakdown.push({ label: `SOL in ${sd} days — NOT MET`, pts: 25, color: B.gold });
    }
  } else if (c.sol && !solIsMet(c.status)) {
    if (sd < 0) breakdown.push({ label: "SOL Expired — NOT MET", pts: 50, color: B.danger });
    else if (sd <= 30) breakdown.push({ label: `SOL in ${sd} days — NOT MET`, pts: 40, color: B.danger });
    else if (sd <= 60) breakdown.push({ label: `SOL in ${sd} days — NOT MET`, pts: 25, color: B.gold });
  }
  if (isLit) {
    if (!hasFiledComplaint(c)) breakdown.push({ label: "No filed complaint on file", pts: 20, color: B.danger });
    if (!c.ld?.discDeadline) breakdown.push({ label: "No discovery deadline set", pts: 15, color: "#eb8c03" });
    if (!c.ld?.trialDate) breakdown.push({ label: "No trial date set", pts: 15, color: "#eb8c03" });
  }
  if (daysOpen > 180 && !(c.totalRec > 0)) breakdown.push({ label: `Case open ${daysOpen} days, no recovery`, pts: 10, color: B.gold });
  if ((c.status === "Intake" || c.status === "New") && daysOpen > 30) breakdown.push({ label: `Intake stalled ${daysOpen} days`, pts: 10, color: B.gold });

  return (
    <div>
      {/* Risk Score Card */}
      <div style={{ ...S.card, marginBottom: 20, borderColor: rc.t + "40" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={S.secT}>Risk Assessment</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: rc.t, ...S.mono }}>{score}</div>
            <div style={{ ...S.badge, background: rc.bg, color: rc.t, fontSize: 12, padding: "4px 12px" }}>{rc.label}</div>
          </div>
        </div>
        {breakdown.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {breakdown.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: `${b.color}10`, border: `1px solid ${b.color}20` }}>
                <span style={{ fontSize: 13, color: b.color }}>{b.label}</span>
                <span style={{ ...S.mono, fontSize: 12, fontWeight: 700, color: b.color }}>+{b.pts}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: "center", color: B.green, fontSize: 13 }}>✅ No risk factors detected</div>
        )}
      </div>

      {/* SOL Status with Confirmation */}
      <div style={{ ...S.card, marginBottom: 20, borderColor: conf.status === "not_set" ? B.danger + "40" : conf.status === "auto" ? B.gold + "40" : B.green + "40" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={S.secT}>Statute of Limitations</div>
          <span style={{ ...S.badge, background: conf.status === "not_set" ? B.dangerBg : conf.status === "auto" ? B.goldBg : B.greenBg, color: conf.color, fontSize: 11 }}>
            {conf.status === "not_set" ? "🔴" : conf.status === "auto" ? "🟡" : "✅"} {conf.label}
          </span>
        </div>

        {conf.status === "not_set" && (
          <div>
            <div style={{ padding: 12, borderRadius: 8, background: B.dangerBg, border: `1px solid ${B.danger}20`, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: B.danger, fontWeight: 600 }}>⚠️ No SOL date set.</span>
              {estimatedSol && (
                <span style={{ color: B.txtM }}> DOL + 1 year suggests <span style={{ color: B.gold, fontWeight: 600, ...S.mono }}>{fmtD(estimatedSol)}</span>.</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Set SOL Date:</span>
              <input type="date" value={solDate} onChange={e => setSolDate(e.target.value)} style={{ ...S.input, width: 180 }} />
              <button onClick={handleConfirmSol} disabled={solSaving} style={{ ...S.btn, opacity: solSaving ? 0.6 : 1 }}>
                {solSaving ? "Saving..." : "Confirm SOL"}
              </button>
            </div>
          </div>
        )}

        {conf.status === "auto" && !solEditing && (
          <div>
            <div style={{ padding: 12, borderRadius: 8, background: B.goldBg, border: `1px solid ${B.gold}20`, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: B.gold, fontWeight: 600 }}>⚠️ This SOL was auto-estimated (DOL + 1 year).</span>
              <span style={{ color: B.txtM }}> Please verify and confirm the correct date.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
              <div style={{ ...S.mono, fontSize: 14, color: B.txtM }}>{fmtD(c.sol)}</div>
              {solBadge(c.sol, c.status, c)}
              {sd !== null && !solIsMet(c.status) && (
                <div style={{ ...S.mono, fontSize: 20, fontWeight: 800, color: sd <= 30 ? B.danger : sd <= 60 ? B.gold : B.txtM }}>{sd}d</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="date" value={solDate} onChange={e => setSolDate(e.target.value)} style={{ ...S.input, width: 180 }} />
              <button onClick={handleConfirmSol} disabled={solSaving} style={{ ...S.btn, opacity: solSaving ? 0.6 : 1 }}>
                {solSaving ? "Saving..." : "Confirm SOL"}
              </button>
            </div>
          </div>
        )}

        {conf.status === "confirmed" && (
          <div>
            {!solEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.green }}>✅ SOL Confirmed: <span style={S.mono}>{fmtD(c.sol)}</span></div>
                {solBadge(c.sol, c.status, c)}
                {sd !== null && !solIsMet(c.status) && (
                  <div style={{ ...S.mono, fontSize: 20, fontWeight: 800, color: sd <= 30 ? B.danger : sd <= 60 ? B.gold : B.green }}>{sd}d</div>
                )}
                <button onClick={() => { setSolEditing(true); setSolDate(c.sol || ""); }} style={{ ...S.btnO, fontSize: 11, padding: "4px 10px", marginLeft: "auto" }}>Edit</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="date" value={solDate} onChange={e => setSolDate(e.target.value)} style={{ ...S.input, width: 180 }} />
                <button onClick={handleConfirmSol} disabled={solSaving} style={{ ...S.btn, opacity: solSaving ? 0.6 : 1 }}>
                  {solSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setSolEditing(false)} style={S.btnO}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filed Complaint */}
      {isLit && <FiledComplaintSection c={c} onCaseUpdate={onCaseUpdate} />}

      {/* Litigation Dates */}
      {isLit && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.secT}>Scheduling Order Dates</div>
          <div style={{ fontSize: 12, color: B.txtM, marginBottom: 12 }}>Add deadlines via the Litigation tab to track compliance.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[{ label: "Discovery Deadline", icon: "📋" }, { label: "Trial Date", icon: "⚖️" }, { label: "Mediation Date", icon: "🤝" }].map(d => (
              <div key={d.label} style={{ padding: 16, borderRadius: 8, background: B.dangerBg, border: `1px solid ${B.danger}20`, textAlign: "center" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{d.icon}</div>
                <div style={{ fontSize: 11, color: B.txtD, marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.danger }}>Not Set</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Contact Log Placeholder */}
      <div style={{ ...S.card }}>
        <div style={S.secT}>📞 Client Contact Log</div>
        <div style={{ padding: 20, textAlign: "center", color: B.txtM, fontSize: 13, borderRadius: 8, border: `1px dashed ${B.bdr}` }}>
          Contact logging will be available once activity_log data is populated.<br />
          <span style={{ fontSize: 11, color: B.txtD }}>Track calls, emails, and meetings with clients here.</span>
        </div>
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
      toast.success("Note added");
      onSaved();
      onClose();
    } catch (err) { console.error("Failed to save note:", err); toast.error("Failed to save note"); }
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
      toast.success("Note added");
      if (onRefresh) onRefresh();
    } catch (err) { console.error("Failed to save note:", err); toast.error("Failed to save note"); }
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

// ═══════════════════════════════════════════════════════════
// DISCOVERY TAB
// ═══════════════════════════════════════════════════════════
function DiscoveryTab({ c, caseId }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedSet, setExpandedSet] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(null);
  const [form, setForm] = useState({ type: "Interrogatories", direction: "Received", title: "", served_date: "", due_date: "", response_date: "", notes: "" });
  const [itemForm, setItemForm] = useState({ item_number: "", request_text: "", response_text: "", status: "Pending" });
  const [saving, setSaving] = useState(false);

  const typeIcons = { Interrogatories: "📝", RFP: "📁", RFA: "✅", Subpoena: "📋", Deposition: "🎤" };
  const statusClr = { Pending: B.txtD, "In Progress": "#4488ff", Completed: B.green, Overdue: B.danger, Objected: B.gold };
  const itemStatusClr = { Pending: B.txtD, Answered: B.green, Objected: B.gold, Supplemented: "#4488ff" };

  const loadSets = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/discovery/sets?case_id=${caseId}`);
      const d = await r.json();
      setSets(Array.isArray(d) ? d : []);
    } catch { setSets([]); }
    setLoading(false);
  };

  const loadItems = async (setId) => {
    setItemsLoading(true);
    try {
      const r = await fetch(`/api/discovery/items?set_id=${setId}`);
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); }
    setItemsLoading(false);
  };

  useEffect(() => { loadSets(); }, [caseId]);

  const createSet = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/discovery/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, case_id: caseId }) });
      // Log discovery set creation
      try { await api.createActivity({ case_id: caseId, type: "discovery", description: `Discovery set added: ${form.title} (${form.type}, ${form.direction})` }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
      setForm({ type: "Interrogatories", direction: "Received", title: "", served_date: "", due_date: "", response_date: "", notes: "" });
      setShowForm(false);
      loadSets();
    } catch {}
    setSaving(false);
  };

  const createItem = async () => {
    if (!itemForm.item_number || !expandedSet) return;
    setSaving(true);
    try {
      await fetch("/api/discovery/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...itemForm, set_id: expandedSet, item_number: parseInt(itemForm.item_number) }) });
      // Log discovery item creation
      try { const setName = sets.find(s => s.id === expandedSet)?.title || "unknown set"; await api.createActivity({ case_id: caseId, type: "discovery", description: `Discovery item #${itemForm.item_number} added to ${setName}` }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
      setItemForm({ item_number: "", request_text: "", response_text: "", status: "Pending" });
      setShowItemForm(false);
      loadItems(expandedSet);
    } catch {}
    setSaving(false);
  };

  const aiDraft = async (item) => {
    setAiDrafting(item.id);
    try {
      const r = await fetch("/api/discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `You are a legal assistant for a property insurance dispute case. Draft a professional response to the following discovery request:\n\nCase: ${c?.client || "Unknown"} - ${c?.ref || ""}\nRequest #${item.item_number}: ${item.request_text || "No text"}\n\nProvide a concise, professional legal response.` }) });
      const d = await r.json();
      if (d.text) {
        await fetch("/api/discovery/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, response_text: d.text, status: "Answered" }) });
        loadItems(expandedSet);
      }
    } catch {}
    setAiDrafting(null);
  };

  const expandSet = (setId) => {
    if (expandedSet === setId) { setExpandedSet(null); setItems([]); return; }
    setExpandedSet(setId);
    loadItems(setId);
  };

  const daysUntil = (d) => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000); };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>Loading discovery...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={S.secT}>Discovery ({sets.length})</div>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>+ New Set</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={S.input}>
                {["Interrogatories", "RFP", "RFA", "Subpoena", "Deposition"].map(t => <option key={t} value={t}>{typeIcons[t]} {t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Direction</label>
              <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })} style={S.input}>
                <option value="Sent">Sent</option><option value="Received">Received</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Defendant's First Set of Interrogatories" style={S.input} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Served Date</label>
              <input type="date" value={form.served_date} onChange={e => setForm({ ...form, served_date: e.target.value })} style={S.input} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={S.input} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Response Date</label>
              <input type="date" value={form.response_date} onChange={e => setForm({ ...form, response_date: e.target.value })} style={S.input} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: B.txtD, marginBottom: 4, display: "block" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createSet} disabled={saving} style={S.btn}>{saving ? "Saving..." : "Create Set"}</button>
            <button onClick={() => setShowForm(false)} style={S.btnO}>Cancel</button>
          </div>
        </div>
      )}

      {sets.length === 0 && !showForm && (
        <div style={{ ...S.card, textAlign: "center", color: B.txtD, padding: 40 }}>
          No discovery sets yet. Click "+ New Set" to add one.
        </div>
      )}

      {sets.map(s => {
        const days = daysUntil(s.due_date);
        const overdue = days !== null && days < 0 && s.status !== "Completed";
        const urgent = days !== null && days >= 0 && days <= 7 && s.status !== "Completed";
        return (
          <div key={s.id} style={{ ...S.card, marginBottom: 8, padding: 0, overflow: "hidden" }}>
            <div onClick={() => expandSet(s.id)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: expandedSet === s.id ? B.cardH : "transparent" }}>
              <span style={{ fontSize: 18 }}>{typeIcons[s.type] || "📄"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                <div style={{ fontSize: 11, color: B.txtM, marginTop: 2 }}>
                  {s.type} · {s.item_count || 0} items
                  {s.due_date && <span> · Due {s.due_date}</span>}
                </div>
              </div>
              <span style={{ ...S.badge, background: `${s.direction === "Sent" ? B.navy : B.purple}20`, color: s.direction === "Sent" ? "#6666cc" : B.purple, fontSize: 10 }}>{s.direction}</span>
              <span style={{ ...S.badge, background: `${overdue ? B.danger : urgent ? B.gold : statusClr[s.status] || B.txtD}15`, color: overdue ? B.danger : urgent ? B.gold : statusClr[s.status] || B.txtD, fontSize: 10 }}>
                {overdue ? "Overdue" : s.status}
                {urgent && !overdue && ` (${days}d)`}
              </span>
              <span style={{ color: B.txtD, fontSize: 12 }}>{expandedSet === s.id ? "▲" : "▼"}</span>
            </div>

            {expandedSet === s.id && (
              <div style={{ borderTop: `1px solid ${B.bdr}`, padding: 16 }}>
                {s.notes && <div style={{ fontSize: 12, color: B.txtM, marginBottom: 12, fontStyle: "italic" }}>{s.notes}</div>}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: B.txtM }}>Items</span>
                  <button onClick={() => setShowItemForm(!showItemForm)} style={{ ...S.btnO, padding: "4px 10px", fontSize: 11 }}>+ Add Item</button>
                </div>

                {showItemForm && (
                  <div style={{ background: B.bg, border: `1px solid ${B.bdr}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: B.txtD }}>Item #</label>
                        <input value={itemForm.item_number} onChange={e => setItemForm({ ...itemForm, item_number: e.target.value })} style={S.input} placeholder="#" />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: B.txtD }}>Request Text</label>
                        <textarea value={itemForm.request_text} onChange={e => setItemForm({ ...itemForm, request_text: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="Enter request text..." />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={createItem} disabled={saving} style={{ ...S.btn, padding: "4px 10px", fontSize: 11 }}>{saving ? "..." : "Add"}</button>
                      <button onClick={() => setShowItemForm(false)} style={{ ...S.btnO, padding: "4px 10px", fontSize: 11 }}>Cancel</button>
                    </div>
                  </div>
                )}

                {itemsLoading ? (
                  <div style={{ padding: 16, textAlign: "center", color: B.txtD, fontSize: 12 }}>Loading items...</div>
                ) : items.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: B.txtD, fontSize: 12 }}>No items yet</div>
                ) : items.map((item, i) => (
                  <div key={item.id} style={{ background: B.bg, border: `1px solid ${B.bdr}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ ...S.mono, fontSize: 11, color: B.gold, fontWeight: 700 }}>#{item.item_number}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ ...S.badge, fontSize: 9, background: `${itemStatusClr[item.status] || B.txtD}15`, color: itemStatusClr[item.status] || B.txtD }}>{item.status}</span>
                        {!item.response_text && (
                          <button onClick={() => aiDraft(item)} disabled={aiDrafting === item.id} style={{ ...S.btnO, padding: "2px 8px", fontSize: 10, color: B.gold, borderColor: B.gold }}>
                            {aiDrafting === item.id ? "Drafting..." : "🤖 AI Draft"}
                          </button>
                        )}
                      </div>
                    </div>
                    {item.request_text && <div style={{ fontSize: 12, color: B.txt, marginBottom: 6, lineHeight: 1.5 }}><strong style={{ color: B.txtD, fontSize: 10 }}>REQUEST:</strong><br />{item.request_text}</div>}
                    {item.response_text && <div style={{ fontSize: 12, color: B.green, marginBottom: 4, lineHeight: 1.5, background: `${B.green}08`, padding: 8, borderRadius: 6 }}><strong style={{ color: B.txtD, fontSize: 10 }}>RESPONSE:</strong><br />{item.response_text}</div>}
                    {item.objection_text && <div style={{ fontSize: 12, color: B.gold, lineHeight: 1.5 }}><strong style={{ color: B.txtD, fontSize: 10 }}>OBJECTION:</strong><br />{item.objection_text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CaseDetail({ c, onBack, onUpdate, user, team, allCases }) {
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
      // Log case edit activity
      try {
        const changed = Object.keys(editForm).filter(k => editForm[k] !== c[k] && editForm[k] !== undefined).join(", ");
        if (changed) await api.createActivity({ case_id: c.id, type: "edit", description: `Case updated: ${changed}`, user_id: user?.id });
      } catch (logErr) { console.warn("Activity log failed:", logErr); }
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
      toast.success("Case updated successfully");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to save: " + err.message });
      toast.error("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const tabs = [
    { id: "overview", l: "Overview" }, { id: "activity", l: "📋 Activity" }, { id: "notes", l: "Notes" },
    { id: "claim", l: "Claim Details" },
    { id: "litigation", l: "Litigation" }, { id: "negotiations", l: "Negotiations" },
    { id: "estimates", l: "Estimates" }, { id: "pleadings", l: "Pleadings" },
    { id: "timeline", l: "Timeline" }, { id: "tasks", l: "Tasks" },
    { id: "docs", l: "Documents" }, { id: "docgen", l: "Generate Docs" },
    { id: "discovery", l: "Discovery" },
    { id: "emails", l: "Emails" },
    { id: "calls", l: "📞 Calls" },
    { id: "contacts", l: "👤 Contacts" },
    { id: "calendar", l: "📅 Calendar" },
    { id: "messages", l: "💬 Messages" },
    { id: "compliance", l: "⚠️ Compliance" },
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
              {c.insurer && <span style={{ fontSize: 12, color: B.txtM }}>{(c.client || "").split(",")[0].split(" ").pop()} v. {c.insurer}</span>}
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

      {/* Workflow Stepper */}
      <WorkflowStepper currentStatus={c.status} onAdvance={(newSt) => changeStatus(newSt)} />

      {/* SOL Warning Banner */}
      {sd != null && sd <= 90 && (
        <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: 8, display: "flex", alignItems: "center", gap: 12, background: sd <= 30 ? B.dangerBg : B.goldBg, border: `1px solid ${sd <= 30 ? B.danger : B.gold}40` }}>
          <span style={{ fontSize: 22 }}>{sd <= 30 ? "🚨" : "⚠️"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: sd <= 30 ? B.danger : B.gold }}>
              {sd <= 30 ? "CRITICAL: " : ""}Statute of Limitations {sd <= 0 ? "has EXPIRED" : `expires in ${sd} days`}
            </div>
            <div style={{ fontSize: 12, color: sd <= 30 ? B.danger : B.gold, opacity: 0.8 }}>SOL Date: {fmtD(c.sol)}</div>
          </div>
          <div style={{ ...S.mono, fontSize: 28, fontWeight: 800, color: sd <= 30 ? B.danger : B.gold }}>{sd}d</div>
        </div>
      )}

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
                    ) : f.k === "insurer" ? (
                      <InsurerAutocomplete value={editForm[f.k] || ""} onChange={v => setEditForm({ ...editForm, [f.k]: v })} cases={allCases} />
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
              <button onClick={() => printCaseSummary(c)} style={{ ...S.btnO, fontSize: 11, padding: "5px 12px" }}>🖨️ Print</button>
              <CaseExportButton caseId={c.id} />
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
              <div onClick={() => setTab("activity")} style={{ padding: "8px 16px", textAlign: "center", fontSize: 11, color: B.gold, cursor: "pointer", borderTop: `1px solid ${B.bdr}` }}>
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

      {tab === "activity" && <ComprehensiveActivityFeed caseId={c.id} />}
      {tab === "overview" && <>
        <CaseDetailCardsNew caseData={c} />
        <div style={{ marginTop: 20, background: B.card, borderRadius: 10, border: `1px solid ${B.bdr}`, padding: 20 }}>
          <ComprehensiveActivityFeed caseId={c.id} limit={20} />
        </div>
        <div style={{ marginTop: 16 }}><CaseOverview c={c} /></div>
      </>}
      {tab === "notes" && <CaseNotesTab c={c} caseId={c.id} user={user} onRefresh={() => setRefreshKey(k => k + 1)} key={refreshKey} />}
      {tab === "claim" && <ClaimDetails c={c} />}
      {tab === "litigation" && <LitDetails c={c} />}
      {tab === "negotiations" && <NegotiationTrackerNew caseId={c.id} />}
      {tab === "estimates" && <CaseEstimatesTab caseId={c.id} />}
      {tab === "pleadings" && <CasePleadingsTab caseId={c.id} />}
      {tab === "timeline" && <CaseTimelineNew caseId={c.id} />}
      {tab === "tasks" && <CaseTasksNew caseId={c.id} teamMembers={team} currentUserId={user?.id} />}
      {tab === "docs" && <CaseDocumentsTab caseId={c.id} />}
      {tab === "docgen" && <DocGenPanel caseId={c.id} caseRef={c.ref} />}
      {tab === "discovery" && <DiscoveryTab c={c} caseId={c.id} />}
      {tab === "emails" && <CaseEmailsNew caseId={c.id} />}
      {tab === "calls" && <CaseCallsNew caseId={c.id} />}
      {tab === "contacts" && <CaseContactsNew caseId={c.id} />}
      {tab === "calendar" && <CaseCalendarTab caseId={c.id} />}
      {tab === "messages" && <CaseMessagesNew caseId={c.id} />}
      {tab === "compliance" && <ComplianceTab c={c} onCaseUpdate={upd => { if (onUpdate) onUpdate(upd); }} />}
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
      // Log task creation activity (no case_id in kanban view)
      setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal" });
      setShowForm(false);
      loadTasks();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const toggleDone = async (task) => {
    try {
      await api.updateTask(task.id, { status: "completed", completed_at: new Date().toISOString() });
      // Log task completion activity
      try { if (task.case_id) await api.createActivity({ case_id: task.case_id, type: "task", description: `Task completed: ${task.title}`, user_id: userId }); } catch (logErr) { console.warn("Activity log failed:", logErr); }
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
  const [dashFilters, setDashFilters] = useState(null);
  const [cases, setCases] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cmdBarOpen, setCmdBarOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [solAlertOpen, setSolAlertOpen] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

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

  // Load task count
  useEffect(() => {
    (async () => {
      try { const t = await api.listTasks({}); setTaskCount((t || []).filter(x => x.status !== "completed").length); } catch {}
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
    const prevCase = cases.find(c => c.id === id);
    setCases(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (selCase && selCase.id === id) setSelCase(prev => ({ ...prev, ...updates }));
    // Only do DB write for status changes from the dropdown (other fields are saved directly in CaseDetail)
    if (supabase && updates.status !== undefined && Object.keys(updates).length === 1) {
      try {
        await api.updateCase(id, { status: updates.status });
        // Log status change activity
        try {
          const fromStatus = prevCase?.status || "Unknown";
          await api.createActivity({ case_id: id, type: "status_change", description: `Status changed from ${fromStatus} to ${updates.status}`, user_id: user?.id });
        } catch (logErr) { console.warn("Activity log failed:", logErr); }
      } catch (e) { console.error("Failed to update case in Supabase:", e); }
    }
  }, [selCase, cases, user]);

  const openCaseById = useCallback(async (caseId) => {
    // Always fetch full case data for activity_log, negotiations, etc.
    try {
      const row = await api.getCase(caseId);
      if (row) {
        const c = sbToCase(row);
        setPage("caseDetail");
        setSelCase(c);
        setStatusFilter("All");
        window.history.pushState({ page: "caseDetail", caseId: c.id, statusFilter: "All" }, "", window.location.pathname);
        return;
      }
    } catch (e) {
      console.error("Failed to load case:", e);
    }
    // Fallback to list version if fetch fails
    const c = cases.find(x => x.id === caseId);
    if (c) {
      setPage("caseDetail");
      setSelCase(c);
      setStatusFilter("All");
      window.history.pushState({ page: "caseDetail", caseId: c.id, statusFilter: "All" }, "", window.location.pathname);
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

  // SOL alerts computation (must be before early returns to maintain hook order)
  // Exclude cases where SOL is met (litigation filed, appraisal, settled, closed)
  const solCases = useMemo(() => cases.filter(c => c.sol && !solIsMet(c.status))
    .map(c => ({ ...c, _solDays: dU(c.sol) }))
    .filter(c => c._solDays <= 90) // includes negative (expired)
    .sort((a, b) => a._solDays - b._solDays), [cases]);
  const criticalCases = useMemo(() => cases.filter(c => calcRiskScore(c, {}) > 60), [cases]);
  const sidebarCounts = { cases: cases.length, tasks: taskCount, solAlerts: solCases.length, criticalCases: criticalCases.length };

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

  const openC = async (c) => {
    try {
      const row = await api.getCase(c.id);
      if (row) {
        navTo("caseDetail", sbToCase(row));
      } else {
        navTo("caseDetail", c);
      }
    } catch (e) {
      console.error("Failed to load full case:", e);
      navTo("caseDetail", c);
    }
  };
  const backC = () => { window.history.back(); };
  const filterByStatus = st => { navTo("cases", null, st); };
  const dashNav = (target, filters) => {
    if (target === "cases") {
      setDashFilters(filters);
      setStatusFilter(filters?.status || "All");
      navTo("cases", null, filters?.status || "All");
    }
  };
  const handleCaseCreated = (row) => {
    const newCase = sbToCase(row);
    setCases(prev => [newCase, ...prev]);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: B.bg }}>
      {/* Mobile hamburger */}
      {isMobile && (
        <button onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu" style={{
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
      <div style={isMobile && !sidebarOpen ? { position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, transform: "translateX(-100%)", transition: "transform 0.2s ease" } : isMobile ? { position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, transform: "translateX(0)", transition: "transform 0.2s ease", overflowY: "auto" } : {}}>
        <Side user={user} active={page === "caseDetail" ? "cases" : page}
          onNav={p => { navTo(p, null, "All"); if (isMobile) setSidebarOpen(false); }}
          onOut={() => { setUser(null); setSidebarOpen(false); if (supabase) api.signOut().catch(() => {}); }}
          onCmdK={() => { setCmdBarOpen(true); if (isMobile) setSidebarOpen(false); }}
          mobileOpen={isMobile ? sidebarOpen : true} onToggleMobile={() => setSidebarOpen(false)} counts={sidebarCounts} />
      </div>
      <CommandBar open={cmdBarOpen} onClose={() => setCmdBarOpen(false)} onOpenCase={openCaseById} cases={cases} />
      <div style={{ marginLeft: isMobile ? 0 : 220, flex: 1, padding: isMobile ? "60px 16px 28px" : "28px 32px", maxWidth: 1200 }}>
        {/* Shimmer animation for skeletons */}
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } } @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        <ToastContainer />
        {/* Global Header Bar */}
        {!loading && user && (
          <GlobalHeader user={user} page={page} selCase={selCase} solCases={solCases} allCases={cases} onOpenCase={openC} onCmdK={() => setCmdBarOpen(true)} criticalCount={criticalCases.length} onNavCompliance={() => navTo("compliance")} />
        )}
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
        {!loading && page === "dashboard" && <DashboardV2 onNavigate={dashNav} />}
        {!loading && page === "cases" && <Cases user={user} cases={cases} onOpen={openC} initialStatus={statusFilter} initialFilters={dashFilters} onClearFilter={() => { setStatusFilter("All"); setDashFilters(null); }} team={team} onBatchUpdate={updateCase} onCaseCreated={handleCaseCreated} />}
        {!loading && page === "caseDetail" && selCase && <CaseDetail c={selCase} onUpdate={updateCase} onBack={backC} user={user} team={team} allCases={cases} />}
        {!loading && page === "calendar" && <CalendarPage />}
        {!loading && page === "tasks" && (
          <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Tasks</h2>
            <TasksKanban userId={user.id} team={team} cases={cases} /></div>
        )}
        {!loading && page === "templates" && <DocTemplates caseId={selCase?.id} caseName={selCase?.client} />}
        {!loading && page === "activity" && <AuditLog onNavigateCase={(caseId) => { const c = cases.find(x => x.id === caseId); if (c) openC(c); }} />}
        {!loading && page === "settings" && <SettingsPage />}
        {!loading && page === "compliance" && <ComplianceDash cases={cases} onOpen={openC} />}
        {!loading && page === "reports" && <ReportsPage />}
        {!loading && page === "contacts" && <ContactsPage />}
        {!loading && page === "compare" && <CaseCompare onSelectCase={(caseId) => { const c = cases.find(x => x.id === caseId); if (c) openC(c); }} />}
        {!loading && page === "intake" && <CaseIntakeForm onClose={() => navTo("cases")} onCreated={(newCase) => { handleCaseCreated(newCase); navTo("caseDetail", newCase); }} teamMembers={team} />}
        {!loading && page === "docs" && (
          <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Documents</h2>
            <DocumentBrowser />
          </div>
        )}
      </div>
    </div>
  );
}
