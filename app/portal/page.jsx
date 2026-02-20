"use client";
import { useState, useEffect } from "react";

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
  if (st.includes("Presuit")) return { bg: "rgba(235,176,3,0.12)", t: B.gold };
  if (st.includes("Presuit")) return { bg: "rgba(91,141,239,0.12)", t: "#5b8def" };
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
  const [authStep, setAuthStep] = useState("login"); // login | code | ready
  const [code, setCode] = useState("");
  const [autoLoading, setAutoLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [emailSent, setEmailSent] = useState(true);
  const [resending, setResending] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState("case");
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const getToken = () => localStorage.getItem("portal_token");

  const loadMessages = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const resp = await fetch("/api/portal/messages", { headers: { "x-portal-token": token } });
      const data = await resp.json();
      if (data.messages) setMessages(data.messages);
    } catch (e) { /* ignore */ }
  };

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    const token = getToken();
    if (!token) return;
    setMsgLoading(true);
    try {
      const resp = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-portal-token": token },
        body: JSON.stringify({ message: newMsg.trim() }),
      });
      const data = await resp.json();
      if (data.message) { setMessages(prev => [...prev, data.message]); setNewMsg(""); }
    } catch (e) { /* ignore */ }
    setMsgLoading(false);
  };

  // Auto-login from saved token
  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    if (!token) { setAutoLoading(false); return; }
    fetch("/api/portal/session", { headers: { "x-portal-token": token } })
      .then(r => r.json())
      .then(data => {
        if (data.case) { setCaseData(data.case); setAuthStep("ready"); }
        else { localStorage.removeItem("portal_token"); }
      })
      .catch(() => localStorage.removeItem("portal_token"))
      .finally(() => setAutoLoading(false));
  }, []);

  // Load messages when tab changes or case loads
  useEffect(() => {
    if (caseData && activeTab === "messages") loadMessages();
  }, [activeTab, caseData]);

  const requestCode = async () => {
    if (!ref.trim() || !lastName.trim()) { setError("Please enter both your case reference and last name."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), lastName: lastName.trim() }),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); }
      else {
        setAuthStep("code");
        setAuthMessage(data.message || "");
        setEmailSent(data.emailSent !== false);
        if (data.ref) setRef(data.ref);
      }
    } catch (err) { setError("Unable to connect. Please try again later."); }
    setLoading(false);
  };

  const resendCode = async () => {
    setResending(true); setError("");
    try {
      const resp = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), lastName: lastName.trim() }),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); }
      else {
        setAuthMessage(data.message || "Code resent!");
        setEmailSent(data.emailSent !== false);
      }
    } catch (err) { setError("Unable to resend. Please try again."); }
    setResending(false);
  };

  const verifyCode = async () => {
    if (!code.trim()) { setError("Please enter the verification code."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/portal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), code: code.trim(), rememberMe }),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); }
      else {
        localStorage.setItem("portal_token", data.token);
        // Fetch case data with token
        const sessResp = await fetch("/api/portal/session", { headers: { "x-portal-token": data.token } });
        const sessData = await sessResp.json();
        if (sessData.case) { setCaseData(sessData.case); setAuthStep("ready"); }
        else { setError("Failed to load case data."); }
      }
    } catch (err) { setError("Unable to connect. Please try again later."); }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem("portal_token");
    setCaseData(null); setAuthStep("login"); setRef(""); setLastName(""); setCode("");
  };

  const ALLOWED_EXTS = ["pdf", "jpg", "jpeg", "png", "docx"];
  const MAX_SIZE = 25 * 1024 * 1024;

  const doUpload = async (file) => {
    setUploadMsg(""); setUploadErr("");
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) { setUploadErr("File type not allowed. Please upload PDF, JPG, PNG, or DOCX."); return; }
    if (file.size > MAX_SIZE) { setUploadErr("File is too large. Maximum size is 25MB."); return; }
    setUploading(true); setUploadProgress(10);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caseId", caseData.id);
      fd.append("clientName", caseData.client);
      setUploadProgress(30);
      const resp = await fetch("/api/portal/upload", { method: "POST", body: fd });
      setUploadProgress(80);
      const data = await resp.json();
      if (data.error) { setUploadErr(data.error); }
      else { setUploadMsg(`✓ "${data.filename}" uploaded successfully. Our team will review it shortly.`); }
    } catch (e) { setUploadErr("Upload failed. Please try again."); }
    setUploading(false); setUploadProgress(100);
    setTimeout(() => setUploadProgress(0), 2000);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
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
        {autoLoading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 16, color: B.txtM }}>Loading...</div>
          </div>
        ) : !caseData ? (
          /* Auth Form */
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Client Portal</h1>
            <p style={{ fontSize: 14, color: B.txtM, textAlign: "center", marginBottom: 32 }}>
              {authStep === "login" ? "Enter your case reference number and last name to get started." : "Enter the 6-digit verification code sent to you."}
            </p>
            <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 32, maxWidth: 440, margin: "0 auto" }}>
              {authStep === "login" ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: B.txtM, marginBottom: 6, display: "block", fontWeight: 600 }}>Case Reference Number</label>
                    <input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. DL-2025-0001" style={S.input}
                      onKeyDown={e => e.key === "Enter" && requestCode()} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: B.txtM, marginBottom: 6, display: "block", fontWeight: 600 }}>Last Name</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Your last name" style={S.input}
                      onKeyDown={e => e.key === "Enter" && requestCode()} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, cursor: "pointer", fontSize: 13, color: B.txtM }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: B.gold, cursor: "pointer" }} />
                    Remember me for 30 days
                  </label>
                  {error && <p style={{ fontSize: 13, color: B.danger, marginBottom: 16 }}>{error}</p>}
                  <button onClick={requestCode} disabled={loading} style={{ ...S.btn, width: "100%", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Verifying..." : "Continue"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12, fontSize: 12, color: B.txtM }}>
                    {authMessage ? (
                      <span>{authMessage}</span>
                    ) : (
                      <>Code sent for <span style={{ color: B.gold, ...S.mono }}>{ref}</span></>
                    )}
                  </div>
                  {!emailSent && (
                    <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(235,176,3,0.08)", border: `1px solid ${B.gold}30`, borderRadius: 6, fontSize: 12, color: B.gold }}>
                      Check with your attorney's office for your code
                    </div>
                  )}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 12, color: B.txtM, marginBottom: 6, display: "block", fontWeight: 600 }}>Verification Code</label>
                    <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6}
                      style={{ ...S.input, ...S.mono, fontSize: 24, textAlign: "center", letterSpacing: 8 }}
                      onKeyDown={e => e.key === "Enter" && verifyCode()} />
                  </div>
                  {error && <p style={{ fontSize: 13, color: B.danger, marginBottom: 16 }}>{error}</p>}
                  <button onClick={verifyCode} disabled={loading} style={{ ...S.btn, width: "100%", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Verifying..." : "Verify & Login"}
                  </button>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                    <button onClick={() => { setAuthStep("login"); setCode(""); setError(""); setAuthMessage(""); }}
                      style={{ background: "transparent", border: "none", color: B.txtM, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                      ← Back
                    </button>
                    <button onClick={resendCode} disabled={resending}
                      style={{ background: "transparent", border: "none", color: B.gold, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: resending ? 0.5 : 1 }}>
                      {resending ? "Resending..." : "Resend code"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Case View */
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 0, background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 8, overflow: "hidden" }}>
                {[["case", "📋 Case"], ["documents", "📄 Documents"], ["schedule", "📅 Schedule"], ["messages", "💬 Messages"]].map(([key, label]) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    style={{ background: activeTab === key ? B.navy : "transparent", color: activeTab === key ? "#fff" : B.txtM, border: "none", padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={logout}
                style={{ background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, color: B.txtM, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Log Out
              </button>
            </div>

            {activeTab === "case" && (<>
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

              {/* Status Timeline Stepper */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: B.txtD, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Where Is My Case?</div>
                <PortalStatusTimeline status={caseData.status} progress={caseData.statusProgress} />
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
              <input type="file" id="portal-file-input" accept=".pdf,.jpg,.jpeg,.png,.docx" style={{ display: "none" }} onChange={handleFileSelect} />
              <div
                style={{ border: `2px dashed ${dragOver ? B.gold : B.bdr}`, borderRadius: 8, padding: 32, textAlign: "center", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1, transition: "border-color 0.2s" }}
                onClick={() => !uploading && document.getElementById("portal-file-input").click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? "⏳" : "📤"}</div>
                <div style={{ fontSize: 13, color: B.txtM }}>{uploading ? "Uploading..." : "Click or drag files here"}</div>
                <div style={{ fontSize: 11, color: B.txtD, marginTop: 4 }}>PDF, JPG, PNG, DOCX up to 25MB</div>
              </div>
              {uploadProgress > 0 && (
                <div style={{ marginTop: 12, height: 4, background: B.bdr, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: B.gold, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              )}
              {uploadMsg && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(56,111,74,0.12)", border: `1px solid ${B.green}30`, borderRadius: 6, fontSize: 12, color: B.green }}>
                  {uploadMsg}
                </div>
              )}
              {uploadErr && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,64,80,0.12)", border: `1px solid ${B.danger}30`, borderRadius: 6, fontSize: 12, color: B.danger }}>
                  {uploadErr}
                </div>
              )}
            </div>

            </>)}

            {activeTab === "documents" && (
              <PortalDocRequests caseId={caseData.id} token={getToken()} />
            )}

            {activeTab === "schedule" && (
              <PortalAppointments caseId={caseData.id} token={getToken()} />
            )}

            {activeTab === "messages" && (
              <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💬</span> Messages
                </div>
                <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {messages.length === 0 && (
                    <div style={{ padding: 32, textAlign: "center", color: B.txtD, fontSize: 13 }}>No messages yet. Send a message to your legal team below.</div>
                  )}
                  {messages.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: m.sender_type === "client" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "75%", padding: "10px 14px", borderRadius: 12,
                        background: m.sender_type === "client" ? B.navy : "#1a1a2a",
                        borderBottomRightRadius: m.sender_type === "client" ? 2 : 12,
                        borderBottomLeftRadius: m.sender_type === "firm" ? 2 : 12,
                      }}>
                        <div style={{ fontSize: 10, color: B.txtD, marginBottom: 4, fontWeight: 600 }}>
                          {m.sender_type === "client" ? "You" : "Denham Law"} · {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div style={{ fontSize: 13, color: B.txt, lineHeight: 1.4 }}>{m.message}</div>
                        {m.sender_type === "client" && m.read_at && (
                          <div style={{ fontSize: 9, color: B.txtD, marginTop: 2, textAlign: "right" }}>✓ Read</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..."
                    style={{ ...S.input, flex: 1 }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()} />
                  <button onClick={sendMessage} disabled={msgLoading || !newMsg.trim()}
                    style={{ ...S.btn, opacity: msgLoading || !newMsg.trim() ? 0.5 : 1, padding: "10px 16px" }}>
                    {msgLoading ? "..." : "Send"}
                  </button>
                </div>
              </div>
            )}

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

// ─── Status Timeline Stepper ────────────────────────────
const PORTAL_STAGES = [
  { key: "Presuit", label: "Presuit", icon: "📥", desc: "Case opened and initial review" },
  { key: "Presuit", label: "Presuit", icon: "🔍", desc: "Gathering evidence and documents" },
  { key: "Presuit", label: "Pre-Suit", icon: "📋", desc: "Preparing demand to insurance" },
  { key: "Demand", label: "Demand Sent", icon: "📤", desc: "Demand sent to insurance company" },
  { key: "Litigation", label: "Litigation", icon: "⚖️", desc: "Filed lawsuit, active litigation" },
  { key: "Settlement", label: "Settlement", icon: "💰", desc: "Case settled or resolved" },
];

function PortalStatusTimeline({ status, progress }) {
  const stageIndex = PORTAL_STAGES.findIndex(s => {
    if (!status) return false;
    const st = status.toLowerCase();
    return st.includes(s.key.toLowerCase()) || (s.key === "Presuit" && st.includes("presuit")) || (s.key === "Demand" && (st.includes("demand") || st.includes("presuit demand"))) || (s.key === "Litigation" && st.includes("litigat")) || (s.key === "Settlement" && (st.includes("settled") || st.includes("closed")));
  });
  const activeIdx = stageIndex >= 0 ? stageIndex : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 8 }}>
        {PORTAL_STAGES.map((stage, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const clr = done ? "#386f4a" : active ? "#ebb003" : "#55556a";
          return (
            <div key={stage.key} style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? "#386f4a" : active ? "#ebb003" : "#1e1e2e", border: `2px solid ${clr}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  {done ? "✓" : stage.icon}
                </div>
                <div style={{ fontSize: 9, color: clr, fontWeight: active ? 700 : 500, marginTop: 4, textAlign: "center", whiteSpace: "nowrap" }}>{stage.label}</div>
              </div>
              {i < PORTAL_STAGES.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? "#386f4a" : "#1e1e2e", margin: "0 -4px", marginBottom: 16 }} />
              )}
            </div>
          );
        })}
      </div>
      {PORTAL_STAGES[activeIdx] && (
        <div style={{ fontSize: 12, color: "#8888a0", textAlign: "center", marginTop: 4 }}>
          Current: <span style={{ color: "#ebb003", fontWeight: 600 }}>{PORTAL_STAGES[activeIdx].label}</span> — {PORTAL_STAGES[activeIdx].desc}
        </div>
      )}
      <div style={{ height: 4, background: "#1e1e2e", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
        <div style={{ height: "100%", width: `${progress || 0}%`, background: "linear-gradient(90deg,#000066,#ebb003)", borderRadius: 2, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

// ─── Portal Document Requests ───────────────────────────
function PortalDocRequests({ caseId, token }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/portal/doc-requests?caseId=${caseId}`, { headers: { "x-portal-token": token } });
        const d = await r.json();
        if (Array.isArray(d)) setRequests(d);
        else if (d.data) setRequests(d.data);
      } catch {}
      setLoading(false);
    })();
  }, [caseId]);

  const handleUpload = async (reqId, file) => {
    setUploading(reqId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", reqId);
      fd.append("caseId", caseId);
      const r = await fetch("/api/portal/doc-requests/upload", { method: "POST", body: fd, headers: { "x-portal-token": token } });
      const d = await r.json();
      if (!d.error) setRequests(prev => prev.map(x => x.id === reqId ? { ...x, status: "uploaded" } : x));
    } catch {}
    setUploading(null);
  };

  const STATUS_CLR = { pending: "#ebb003", uploaded: "#386f4a", reviewed: "#5b8def" };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading...</div>;

  return (
    <div style={{ background: "#111119", border: "1px solid #1e1e2e", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span>📄</span> Document Requests
      </div>
      <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 16 }}>
        Your legal team has requested the following documents. Please upload them as soon as possible.
      </p>
      {requests.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#55556a", fontSize: 13 }}>No document requests at this time. ✓</div>
      ) : requests.map(req => (
        <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1e1e2e06" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#e8e8f0" }}>{req.description}</div>
            <div style={{ fontSize: 11, color: "#55556a", marginTop: 2 }}>Requested {new Date(req.created_at).toLocaleDateString()}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${STATUS_CLR[req.status] || "#55556a"}20`, color: STATUS_CLR[req.status] || "#55556a" }}>{req.status}</span>
            {req.status === "pending" && (
              <>
                <input type="file" id={`doc-req-${req.id}`} style={{ display: "none" }} onChange={e => e.target.files[0] && handleUpload(req.id, e.target.files[0])} />
                <button onClick={() => document.getElementById(`doc-req-${req.id}`).click()} disabled={uploading === req.id}
                  style={{ background: "#ebb003", color: "#000", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {uploading === req.id ? "..." : "📤 Upload"}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Portal Appointments ────────────────────────────────
function PortalAppointments({ caseId, token }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState(false);
  const [form, setForm] = useState({ type: "consultation", date: "", time: "10:00", notes: "" });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/portal/appointments?caseId=${caseId}`, { headers: { "x-portal-token": token } });
        const d = await r.json();
        if (Array.isArray(d)) setAppointments(d);
        else if (d.data) setAppointments(d.data);
      } catch {}
      setLoading(false);
    })();
  }, [caseId]);

  const book = async () => {
    if (!form.date || !form.time) return;
    setBooking(true);
    try {
      const dt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const r = await fetch("/api/portal/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-portal-token": token },
        body: JSON.stringify({ caseId, datetime: dt, type: form.type, notes: form.notes }),
      });
      const d = await r.json();
      if (!d.error) { setAppointments(prev => [...prev, d.data || d]); setShowBook(false); setForm({ type: "consultation", date: "", time: "10:00", notes: "" }); }
    } catch {}
    setBooking(false);
  };

  const TYPE_ICON = { consultation: "📞", deposition: "📝", mediation: "🤝" };
  const STATUS_CLR = { scheduled: "#ebb003", confirmed: "#386f4a", cancelled: "#e04050", completed: "#55556a" };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8888a0" }}>Loading...</div>;

  // Generate available time slots (weekdays 9-5)
  const timeSlots = [];
  for (let h = 9; h <= 16; h++) {
    timeSlots.push(`${h.toString().padStart(2, "0")}:00`);
    timeSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  return (
    <div style={{ background: "#111119", border: "1px solid #1e1e2e", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📅</span> Appointments
        </div>
        <button onClick={() => setShowBook(!showBook)} style={{ background: "#ebb003", color: "#000", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Request Appointment
        </button>
      </div>

      {showBook && (
        <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", marginBottom: 4 }}>Type</div>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px", color: "#e8e8f0", fontSize: 13, width: "100%" }}>
                <option value="consultation">📞 Consultation</option>
                <option value="deposition">📝 Deposition</option>
                <option value="mediation">🤝 Mediation</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", marginBottom: 4 }}>Preferred Date</div>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={new Date().toISOString().slice(0, 10)}
                style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px", color: "#e8e8f0", fontSize: 13, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", marginBottom: 4 }}>Preferred Time</div>
              <select value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px", color: "#e8e8f0", fontSize: 13, width: "100%" }}>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..."
                style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px", color: "#e8e8f0", fontSize: 13, width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button onClick={() => setShowBook(false)} style={{ background: "transparent", border: "1px solid #1e1e2e", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "#8888a0", cursor: "pointer" }}>Cancel</button>
            <button onClick={book} disabled={booking} style={{ background: "#ebb003", color: "#000", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: booking ? 0.5 : 1 }}>{booking ? "..." : "Request"}</button>
          </div>
        </div>
      )}

      {appointments.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#55556a", fontSize: 13 }}>No upcoming appointments.</div>
      ) : appointments.map(apt => (
        <div key={apt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1e1e2e06" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>{TYPE_ICON[apt.type] || "📅"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#e8e8f0" }}>{(apt.type || "Appointment").charAt(0).toUpperCase() + (apt.type || "").slice(1)}</div>
              <div style={{ fontSize: 12, color: "#8888a0", fontFamily: "'JetBrains Mono',monospace" }}>{new Date(apt.datetime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              {apt.notes && <div style={{ fontSize: 11, color: "#55556a", marginTop: 2 }}>{apt.notes}</div>}
            </div>
          </div>
          <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${STATUS_CLR[apt.status] || "#55556a"}20`, color: STATUS_CLR[apt.status] || "#55556a" }}>{apt.status}</span>
        </div>
      ))}
    </div>
  );
}

