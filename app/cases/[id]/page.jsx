"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import * as api from "../../../lib/api";
import { useParams, useRouter } from "next/navigation";

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

const LOSS_ICON = { Fire: "🔥", Water: "💧", Wind: "🌬️", Hail: "🧊", Other: "❓" };

const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 },
  badge: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
  input: { background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 12px", color: B.txt, fontSize: 13, outline: "none", width: "100%", fontFamily: "'DM Sans',sans-serif" },
  btn: { background: B.gold, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnO: { background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: B.txtM, fontFamily: "'DM Sans',sans-serif" },
  secT: { fontSize: 15, fontWeight: 700, color: B.txt, marginBottom: 16 },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 16px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  td: { padding: "10px 16px", borderBottom: `1px solid ${B.bdr}06` },
};

const fmt = n => "$" + Number(n).toLocaleString("en-US");
const fmtD = d => { if (!d) return "—"; return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const fmtSize = bytes => { if (!bytes) return "—"; if (bytes < 1024) return bytes + " B"; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / 1048576).toFixed(1) + " MB"; };

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

function sbToCase(row) {
  const att = row.attorney || {};
  const sup = row.support || {};
  const cd = Array.isArray(row.claim_details) ? row.claim_details[0] : row.claim_details || {};
  const ld = Array.isArray(row.litigation_details) ? row.litigation_details[0] : row.litigation_details || null;
  return {
    id: row.id, ref: row.ref, client: row.client_name,
    clientPhone: row.client_phone, clientEmail: row.client_email,
    type: row.type, status: row.status, juris: row.jurisdiction,
    attorney: { id: att.id, name: att.name || "Unassigned", role: att.role, title: att.title, ini: att.initials || "?", clr: att.color || "#888" },
    support: { id: sup.id, name: sup.name || "Unassigned", role: sup.role, title: sup.title, ini: sup.initials || "?", clr: sup.color || "#888" },
    dol: row.date_of_loss, dop: row.date_opened, sol: row.statute_of_limitations,
    insurer: row.insurer, cn: row.claim_number, pn: row.policy_number,
    totalRec: Number(row.total_recovery) || 0, attFees: Number(row.attorney_fees) || 0,
    cd: {
      policyNumber: cd?.policy_number || row.policy_number, claimNumber: cd?.claim_number || row.claim_number,
      insurer: cd?.insurer || row.insurer, adjuster: cd?.adjuster_name, adjPhone: cd?.adjuster_phone,
      adjEmail: cd?.adjuster_email, dateOfLoss: cd?.date_of_loss || row.date_of_loss,
      dateReported: cd?.date_reported, dateDenied: cd?.date_denied, policyType: cd?.policy_type,
      policyLimits: cd?.policy_limits, deductible: cd?.deductible, causeOfLoss: cd?.cause_of_loss,
      propAddr: cd?.property_address,
    },
    ld: ld ? {
      caseNum: ld.case_number, court: ld.court, judge: ld.judge, filedDate: ld.filed_date,
      oppCounsel: ld.opposing_counsel, oppFirm: ld.opposing_firm, oppPhone: ld.opposing_phone,
      oppEmail: ld.opposing_email, trialDate: ld.trial_date, medDate: ld.mediation_date,
      discDeadline: ld.discovery_deadline, docUrl: ld.doc_url,
    } : null,
    negs: (row.negotiations || []).map(n => ({ id: n.id, date: n.date, type: n.type, amount: Number(n.amount) || 0, notes: n.notes, by: n.by_name })),
    ests: (row.estimates || []).map(e => ({ id: e.id, date: e.date, type: e.type, amount: Number(e.amount) || 0, vendor: e.vendor, notes: e.notes })),
    acts: (row.activity_log || []).map(a => ({ id: a.id, date: a.date, time: a.time, type: a.type, actor: a.actor_name, aIni: a.actor_initials, aClr: a.actor_color, title: a.title, desc: a.description })),
  };
}

// ─── Document Section ───────────────────────────────────────
function CaseDocuments({ caseId }) {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`/api/cases/${caseId}/docs`);
        const data = await resp.json();
        setDocs(data);
      } catch (err) {
        setDocs({ matched: false, error: err.message });
      }
      setLoading(false);
    })();
  }, [caseId]);

  const toggleFolder = (key) => {
    setExpandedFolders(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const fileIcon = ext => {
    if ([".pdf"].includes(ext)) return "📕";
    if ([".doc", ".docx"].includes(ext)) return "📘";
    if ([".xls", ".xlsx"].includes(ext)) return "📗";
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff"].includes(ext)) return "🖼️";
    if ([".msg", ".eml"].includes(ext)) return "📧";
    return "📄";
  };

  if (loading) return <div style={{ ...S.card, padding: 40, textAlign: "center", color: B.txtM }}>Loading documents...</div>;

  if (!docs?.matched) {
    return (
      <div style={{ ...S.card, padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Documents Found</div>
        <div style={{ fontSize: 13, color: B.txtM }}>
          {docs?.error ? docs.error : `No matching Clio folder found for this client.`}
        </div>
      </div>
    );
  }

  const totalFiles = (docs.subfolders || []).reduce((sum, sf) => {
    const rootCount = (sf.files || []).length;
    const subCount = (sf.subdirs || []).reduce((s, sd) => s + (sd.files || []).length, 0);
    return sum + rootCount + subCount;
  }, 0) + (docs.rootFiles || []).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: B.txtD }}>
          Clio folder: <span style={{ ...S.mono, color: B.gold }}>{docs.clioFolder}</span>
        </span>
        <span style={{ ...S.badge, background: B.greenBg, color: B.green }}>{totalFiles} files</span>
      </div>

      {/* Root files */}
      {(docs.rootFiles || []).length > 0 && (
        <div style={{ ...S.card, marginBottom: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: B.gold, marginBottom: 12 }}>📁 Root Files</h4>
          {docs.rootFiles.map((f, i) => (
            <div key={i} style={{ padding: "6px 0", fontSize: 13, color: B.txtM, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{fileIcon((f.ext || f.substring(f.lastIndexOf("."))).toLowerCase())}</span>
              <span>{typeof f === "string" ? f : f.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Subfolders */}
      {(docs.subfolders || []).map((sf, si) => {
        const sfKey = `sf-${si}`;
        const isExpanded = expandedFolders.has(sfKey);
        const fileCount = (sf.files || []).length + (sf.subdirs || []).reduce((s, sd) => s + (sd.files || []).length, 0);

        return (
          <div key={si} style={{ ...S.card, marginBottom: 8, padding: 0, overflow: "hidden" }}>
            <div onClick={() => toggleFolder(sfKey)}
              style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseEnter={e => e.currentTarget.style.background = B.cardH}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                <span style={{ fontSize: 16 }}>📁</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{sf.name}</span>
              </div>
              <span style={{ ...S.mono, fontSize: 11, color: B.txtD }}>{fileCount} files</span>
            </div>

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${B.bdr}` }}>
                {/* Direct files in subfolder */}
                {(sf.files || []).length > 0 && (
                  <table style={{ ...S.tbl, margin: 0 }}>
                    <thead><tr>
                      <th style={S.th}>File</th>
                      <th style={{ ...S.th, width: 100 }}>Size</th>
                      <th style={{ ...S.th, width: 140 }}>Modified</th>
                    </tr></thead>
                    <tbody>
                      {sf.files.map((f, fi) => (
                        <tr key={fi}>
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

                {/* Category subdirectories */}
                {(sf.subdirs || []).map((sd, sdi) => {
                  const sdKey = `${sfKey}-${sdi}`;
                  const sdExpanded = expandedFolders.has(sdKey);
                  return (
                    <div key={sdi}>
                      <div onClick={() => toggleFolder(sdKey)}
                        style={{ padding: "8px 16px 8px 32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${B.bdr}06` }}
                        onMouseEnter={e => e.currentTarget.style.background = B.cardH}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, transition: "transform 0.2s", transform: sdExpanded ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                          <span style={{ fontSize: 14 }}>📂</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: B.txtM }}>{sd.name}</span>
                        </div>
                        <span style={{ ...S.mono, fontSize: 10, color: B.txtD }}>{sd.files.length}</span>
                      </div>
                      {sdExpanded && (
                        <table style={{ ...S.tbl, margin: 0 }}>
                          <tbody>
                            {sd.files.map((f, fi) => (
                              <tr key={fi}>
                                <td style={{ ...S.td, paddingLeft: 48, display: "flex", alignItems: "center", gap: 8 }}>
                                  <span>{fileIcon(f.ext)}</span>
                                  <span style={{ fontSize: 12 }}>{f.name}</span>
                                </td>
                                <td style={{ ...S.td, ...S.mono, fontSize: 11, color: B.txtM, width: 100 }}>{fmtSize(f.size)}</td>
                                <td style={{ ...S.td, ...S.mono, fontSize: 11, color: B.txtM, width: 140 }}>{f.modified ? fmtD(f.modified.split("T")[0]) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail Field ───────────────────────────────────────────
function Field({ label, value, mono, color, href }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      {href ? (
        <a href={href} style={{ fontSize: mono ? 13 : 14, fontWeight: 500, color: color || B.gold, ...(mono ? S.mono : {}), textDecoration: "none" }}>{value || "—"}</a>
      ) : (
        <div style={{ fontSize: mono ? 13 : 14, fontWeight: 500, color: color || B.txt, ...(mono ? S.mono : {}) }}>{value || "—"}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN CASE DETAIL PAGE
// ═══════════════════════════════════════════════════════════
export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [c, setCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    (async () => {
      try {
        const row = await api.getCase(params.id);
        if (row) setCase(sbToCase(row));
        else setError("Case not found");
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, color: B.txtM }}>Loading case...</div>
        </div>
      </div>
    );
  }

  if (error || !c) {
    return (
      <div style={{ minHeight: "100vh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...S.card, padding: 40, textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: B.danger }}>Case Not Found</h2>
          <p style={{ fontSize: 13, color: B.txtM }}>{error || "The requested case could not be found."}</p>
          <button onClick={() => router.push("/")} style={{ ...S.btn, marginTop: 20 }}>← Back to Cases</button>
        </div>
      </div>
    );
  }

  const sc = stClr(c.status);
  const d = c.cd || {};
  const telHref = p => p ? `tel:${p.replace(/[^0-9+]/g, "")}` : "";
  const mailHref = e => e ? `mailto:${e}` : "";

  const TABS = [
    { id: "overview", label: "Overview", icon: "📋" },
    { id: "details", label: "Details", icon: "📎" },
    { id: "timeline", label: "Timeline", icon: "📅" },
    { id: "notes", label: "Notes", icon: "✍️" },
    { id: "tasks", label: "Tasks", icon: "☐" },
    { id: "documents", label: "Documents", icon: "📁" },
    { id: "negotiations", label: "Negotiations", icon: "💰" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: B.bg, color: B.txt, fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ background: B.card, borderBottom: `1px solid ${B.bdr}`, padding: "16px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <button onClick={() => router.push("/")} style={{ ...S.btnO, fontSize: 12, padding: "4px 12px", marginBottom: 12 }}>
            ← Back to Cases
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 32 }}>{LOSS_ICON[c.type] || "❓"}</div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{c.client}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ ...S.mono, fontSize: 13, color: B.gold }}>{c.ref}</span>
                  <span style={{ ...S.badge, background: sc.bg, color: sc.t }}>{c.status}</span>
                  {c.juris && <span style={{ fontSize: 12, color: B.txtD }}>📍 {c.juris}</span>}
                  <span style={{ fontSize: 12, color: B.txtD }}>v. {c.insurer || "Unknown"}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {c.attorney?.ini && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.attorney.clr, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{c.attorney.ini}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.attorney.name}</div>
                    <div style={{ fontSize: 10, color: B.txtD }}>Attorney</div>
                  </div>
                </div>
              )}
              {c.support?.name !== "Unassigned" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.support.clr, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{c.support.ini}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.support.name}</div>
                    <div style={{ fontSize: 10, color: B.txtD }}>Support</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: B.card, borderBottom: `1px solid ${B.bdr}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "12px 20px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? B.gold : B.txtM,
              borderBottom: tab === t.id ? `2px solid ${B.gold}` : "2px solid transparent",
              fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Key Details */}
            <div style={S.card}>
              <h3 style={S.secT}>Key Details</h3>
              <Field label="Insurance Company" value={c.insurer} />
              <Field label="Date of Loss" value={fmtD(c.dol)} mono />
              <Field label="Date Opened" value={fmtD(c.dop)} mono />
              <Field label="Statute of Limitations" value={c.sol ? fmtD(c.sol) : "Not set"} mono color={c.sol ? B.txt : B.danger} />
              <Field label="Policy Number" value={c.pn} mono />
              <Field label="Claim Number" value={c.cn} mono />
              <Field label="Loss Type" value={c.type ? `${LOSS_ICON[c.type] || ""} ${c.type}` : "—"} />
            </div>

            {/* Adjuster & Contact */}
            <div style={S.card}>
              <h3 style={S.secT}>Contact Information</h3>
              <Field label="Client Phone" value={c.clientPhone} mono href={telHref(c.clientPhone)} />
              <Field label="Client Email" value={c.clientEmail} mono href={mailHref(c.clientEmail)} />
              <div style={{ borderTop: `1px solid ${B.bdr}`, margin: "16px 0", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: B.gold, marginBottom: 12 }}>Adjuster</div>
                <Field label="Name" value={d.adjuster} />
                <Field label="Phone" value={d.adjPhone} mono href={telHref(d.adjPhone)} />
                <Field label="Email" value={d.adjEmail} mono href={mailHref(d.adjEmail)} />
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ ...S.card, gridColumn: "1/-1" }}>
              <h3 style={S.secT}>Financial Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Total Recovery</div>
                  <div style={{ ...S.mono, fontSize: 22, fontWeight: 700, color: B.green }}>{c.totalRec > 0 ? fmt(c.totalRec) : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Attorney Fees</div>
                  <div style={{ ...S.mono, fontSize: 22, fontWeight: 700, color: B.gold }}>{c.attFees > 0 ? fmt(c.attFees) : "—"}</div>
                </div>
                {(() => {
                  const lastDemand = (c.negs || []).filter(n => n.type === "plaintiff_offer" || n.type === "presuit_demand").sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                  const lastOffer = (c.negs || []).filter(n => n.type === "defendant_offer").sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                  return (<>
                    <div>
                      <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Last Demand</div>
                      <div style={{ ...S.mono, fontSize: 22, fontWeight: 700, color: "#e0a050" }}>{lastDemand ? fmt(lastDemand.amount) : "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Last Offer</div>
                      <div style={{ ...S.mono, fontSize: 22, fontWeight: 700, color: "#5b8def" }}>{lastOffer ? fmt(lastOffer.amount) : "—"}</div>
                    </div>
                  </>);
                })()}
              </div>
            </div>

            {/* Litigation Details (if applicable) */}
            {c.ld && (
              <div style={{ ...S.card, gridColumn: "1/-1" }}>
                <h3 style={S.secT}>⚖️ Litigation</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <Field label="Case Number" value={c.ld.caseNum} mono />
                  <Field label="Court" value={c.ld.court} />
                  <Field label="Judge" value={c.ld.judge} />
                  <Field label="Filed Date" value={fmtD(c.ld.filedDate)} mono />
                  <Field label="Trial Date" value={c.ld.trialDate ? fmtD(c.ld.trialDate) : "Not set"} mono color={c.ld.trialDate ? B.danger : B.txtD} />
                  <Field label="Discovery Deadline" value={fmtD(c.ld.discDeadline)} mono />
                  <Field label="Opposing Counsel" value={c.ld.oppCounsel} />
                  <Field label="Opposing Firm" value={c.ld.oppFirm} />
                  <Field label="Opp. Email" value={c.ld.oppEmail} mono href={mailHref(c.ld.oppEmail)} />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "details" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.card}>
              <h3 style={{ ...S.secT, marginBottom: 20 }}>Policy Information</h3>
              <Field label="Policy Number" value={d.policyNumber} mono />
              <Field label="Claim Number" value={d.claimNumber} mono />
              <Field label="Insurance Company" value={d.insurer} />
              <Field label="Policy Type" value={d.policyType} />
              <Field label="Policy Limits" value={d.policyLimits} mono color={B.gold} />
              <Field label="Deductible" value={d.deductible} mono />
            </div>
            <div style={S.card}>
              <h3 style={{ ...S.secT, marginBottom: 20 }}>Claim Information</h3>
              <Field label="Date of Loss" value={fmtD(d.dateOfLoss)} mono />
              <Field label="Date Reported" value={fmtD(d.dateReported)} mono />
              <Field label="Date Denied" value={d.dateDenied ? fmtD(d.dateDenied) : "Not denied"} mono color={d.dateDenied ? B.danger : B.green} />
              <Field label="Cause of Loss" value={d.causeOfLoss} />
              {d.propAddr && <Field label="Property Address" value={d.propAddr} />}
            </div>
          </div>
        )}

        {tab === "timeline" && (
          <div style={S.card}>
            <h3 style={S.secT}>Activity Timeline</h3>
            {(c.acts || []).length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 14 }}>No activity recorded yet</div>
              </div>
            ) : (
              <div>
                {[...(c.acts || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map((a, i) => (
                  <div key={a.id || i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${B.bdr}06` }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: a.aClr || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{a.aIni || "?"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{a.actor}</span>
                        <span style={{ fontSize: 12, color: B.txtM }}>{a.title}</span>
                        <span style={{ marginLeft: "auto", ...S.mono, fontSize: 11, color: B.txtD }}>{fmtD(a.date)} {a.time}</span>
                      </div>
                      {a.desc && <div style={{ fontSize: 12, color: B.txtD }}>{a.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "notes" && (
          <div style={S.card}>
            <h3 style={S.secT}>Notes</h3>
            <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
              <div style={{ fontSize: 14 }}>Notes section — coming soon</div>
              <div style={{ fontSize: 12, color: B.txtD, marginTop: 4 }}>Use the main portal for full notes functionality</div>
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div style={S.card}>
            <h3 style={S.secT}>Tasks</h3>
            <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>☐</div>
              <div style={{ fontSize: 14 }}>Tasks section — coming soon</div>
              <div style={{ fontSize: 12, color: B.txtD, marginTop: 4 }}>Use the main portal for full task management</div>
            </div>
          </div>
        )}

        {tab === "documents" && <CaseDocuments caseId={c.id} />}

        {tab === "negotiations" && (
          <div>
            {(c.negs || []).length === 0 ? (
              <div style={{ ...S.card, padding: 40, textAlign: "center", color: B.txtD }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                <div style={{ fontSize: 14 }}>No negotiations recorded</div>
              </div>
            ) : (
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <table style={S.tbl}>
                  <thead><tr>
                    <th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Amount</th><th style={S.th}>Notes</th><th style={S.th}>By</th>
                  </tr></thead>
                  <tbody>
                    {[...(c.negs || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map((n, i) => (
                      <tr key={i}>
                        <td style={{ ...S.td, ...S.mono, fontSize: 12 }}>{fmtD(n.date)}</td>
                        <td style={S.td}><span style={{ ...S.badge, background: B.goldBg, color: B.gold }}>{(n.type || "").replace(/_/g, " ")}</span></td>
                        <td style={{ ...S.td, ...S.mono, fontSize: 13, fontWeight: 600, color: B.green }}>{fmt(n.amount)}</td>
                        <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{n.notes}</td>
                        <td style={{ ...S.td, fontSize: 12, color: B.txtM }}>{n.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
