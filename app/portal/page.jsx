"use client";
import { useState } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", cardH: "#16161f",
  bdr: "#1e1e2e", txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050",
};

const S = {
  input: {
    background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6,
    padding: "10px 14px", color: B.txt, fontSize: 14, outline: "none",
    width: "100%", fontFamily: "'DM Sans',sans-serif",
  },
  btn: {
    background: B.gold, color: "#000", border: "none", borderRadius: 6,
    padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
  },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
};

const fmtD = d => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const aIcon = t => ({ call: "📞", email: "✉️", task: "✅", document: "📄", negotiation: "💰", pleading: "⚖️", estimate: "📊", status_change: "🔄", deadline: "⏰" }[t] || "•");

function stClr(st) {
  if (!st) return { bg: "rgba(85,85,106,0.15)", t: B.txtD };
  if (st.includes("Intake")) return { bg: "rgba(235,176,3,0.12)", t: B.gold };
  if (st.includes("Investigation")) return { bg: "rgba(91,141,239,0.12)", t: "#5b8def" };
  if (st.includes("Presuit")) return { bg: "rgba(235,176,3,0.12)", t: "#e0a050" };
  if (st.includes("Litigation")) return { bg: "rgba(0,0,102,0.2)", t: "#6b6bff" };
  if (st.includes("Settled")) return { bg: "rgba(56,111,74,0.12)", t: B.green };
  if (st.includes("Closed")) return { bg: "rgba(85,85,106,0.15)", t: B.txtD };
  return { bg: "rgba(85,85,106,0.15)", t: B.txtD };
}

export default function ClientPortal() {
  const [ref, setRef] = useState("");
  const [lastName, setLastName] = useState("");
  const [caseData, setCaseData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const lookup = async () => {
    if (!ref.trim() || !lastName.trim()) { setError("Please enter both your case reference and last name."); return; }
    setLoading(true); setError(""); setCaseData(null);
    try {
      const resp = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), lastName: lastName.trim() }),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); }
      else { setCaseData(data.case); }
    } catch (err) { setError("Unable to connect. Please try again later."); }
    setLoading(false);
  };

  const handleUpload = () => {
    setUploadMsg("Thank you! Your document has been received. Our team will review it shortly.");
    setTimeout(() => setUploadMsg(""), 5000);
  };

  return (
    <div style={{ minHeight: "100vh", background: B.bg, color: B.txt, fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${B.bdr}`, padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B.navy},${B.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>D</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>DENHAM LAW</div>
          <div style={{ fontSize: 11, color: B.txtD }}>Client Portal</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: B.txtM }}>859-900-BART · denham.law</div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        {!caseData ? (
          /* Lookup Form */
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Case Lookup</h1>
            <p style={{ fontSize: 14, color: B.txtM, textAlign: "center", marginBottom: 32 }}>
              Enter your case reference number and last name to view your case status.
            </p>
            <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 32, maxWidth: 440, margin: "0 auto" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: B.txtM, marginBottom: 6, display: "block", fontWeight: 600 }}>Case Reference Number</label>
                <input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. DL-2025-0001" style={S.input}
                  onKeyDown={e => e.key === "Enter" && lookup()} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: B.txtM, marginBottom: 6, display: "block", fontWeight: 600 }}>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Your last name" style={S.input}
                  onKeyDown={e => e.key === "Enter" && lookup()} />
              </div>
              {error && <p style={{ fontSize: 13, color: B.danger, marginBottom: 16 }}>{error}</p>}
              <button onClick={lookup} disabled={loading} style={{ ...S.btn, width: "100%", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Looking up..." : "View My Case"}
              </button>
            </div>
          </div>
        ) : (
          /* Case View */
          <div>
            <button onClick={() => { setCaseData(null); setRef(""); setLastName(""); }}
              style={{ background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, color: B.txtM, cursor: "pointer", marginBottom: 24, fontFamily: "'DM Sans',sans-serif" }}>
              ← Back to Lookup
            </button>

            {/* Case Header */}
            <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{caseData.client}</h2>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ ...S.mono, fontSize: 13, color: B.gold }}>{caseData.ref}</span>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: stClr(caseData.status).bg, color: stClr(caseData.status).t }}>{caseData.status}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: B.txtD }}>Attorney</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{caseData.attorney}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: B.txtD, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Case Progress</div>
                <div style={{ height: 6, background: B.bdr, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${caseData.statusProgress}%`, background: `linear-gradient(90deg,${B.navy},${B.gold})`, borderRadius: 3, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 10, color: B.txtM, marginTop: 4 }}>{caseData.statusProgress}% complete</div>
              </div>
            </div>

            {/* Key Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { l: "Type", v: caseData.type },
                { l: "Jurisdiction", v: caseData.jurisdiction },
                { l: "Insurance Company", v: caseData.insurer },
                { l: "Date of Loss", v: fmtD(caseData.dateOfLoss) },
                { l: "Date Opened", v: fmtD(caseData.dateOpened) },
                { l: "Cause of Loss", v: caseData.causeOfLoss || "—" },
              ].map((x, i) => (
                <div key={i} style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{x.v}</div>
                </div>
              ))}
            </div>

            {/* Next Steps */}
            {caseData.nextSteps && caseData.nextSteps.length > 0 && (
              <div style={{ background: B.card, border: `1px solid ${B.green}30`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: B.green, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📋</span> What's Happening Next
                </div>
                {caseData.nextSteps.map((step, i) => (
                  <div key={i} style={{ padding: "6px 0", fontSize: 13, color: B.txt, display: "flex", gap: 8 }}>
                    <span style={{ color: B.green }}>→</span> {step}
                  </div>
                ))}
              </div>
            )}

            {/* Litigation Info */}
            {caseData.inLitigation && (
              <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6b6bff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚖️</span> Litigation Details
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {caseData.courtCase && <div><div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 2 }}>Case Number</div><div style={{ ...S.mono, fontSize: 13 }}>{caseData.courtCase}</div></div>}
                  {caseData.court && <div><div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 2 }}>Court</div><div style={{ fontSize: 13 }}>{caseData.court}</div></div>}
                  {caseData.trialDate && <div><div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 2 }}>Trial Date</div><div style={{ ...S.mono, fontSize: 13, color: B.danger }}>{fmtD(caseData.trialDate)}</div></div>}
                </div>
              </div>
            )}

            {/* Timeline */}
            {caseData.timeline && caseData.timeline.length > 0 && (
              <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📅</span> Case Timeline
                </div>
                {caseData.timeline.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < caseData.timeline.length - 1 ? `1px solid ${B.bdr}06` : "none" }}>
                    <div style={{ width: 28, textAlign: "center", fontSize: 14, flexShrink: 0 }}>{aIcon(ev.type)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.title}</div>
                      <div style={{ ...S.mono, fontSize: 11, color: B.txtD }}>{fmtD(ev.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Documents */}
            <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📎</span> Upload Documents
              </div>
              <p style={{ fontSize: 12, color: B.txtM, marginBottom: 16 }}>
                Have photos, receipts, or other documents to share with your legal team? Upload them here.
              </p>
              <div style={{ border: `2px dashed ${B.bdr}`, borderRadius: 8, padding: 32, textAlign: "center", cursor: "pointer" }}
                onClick={handleUpload}
                onMouseEnter={e => e.currentTarget.style.borderColor = B.gold}
                onMouseLeave={e => e.currentTarget.style.borderColor = B.bdr}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                <div style={{ fontSize: 13, color: B.txtM }}>Click to select files</div>
                <div style={{ fontSize: 11, color: B.txtD, marginTop: 4 }}>PDF, JPG, PNG, DOCX up to 25MB</div>
              </div>
              {uploadMsg && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(56,111,74,0.12)", border: `1px solid ${B.green}30`, borderRadius: 6, fontSize: 12, color: B.green }}>
                  {uploadMsg}
                </div>
              )}
            </div>

            {/* Contact */}
            <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: B.txtD }}>
              Questions? Call us at <span style={{ color: B.gold }}>859-900-BART</span> or email <span style={{ color: B.gold }}>info@denham.law</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
