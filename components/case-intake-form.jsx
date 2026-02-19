"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const DARK_BG = "#08080f";
const CARD_BG = "#111119";
const INPUT_BG = "#0a0a14";
const BORDER = "#1e1e2e";
const BORDER_L = "#2a2a3a";
const TEXT = "#e8e8f0";
const TEXT_M = "#8888a0";
const TEXT_D = "#55556a";
const DANGER = "#e04050";

const STEPS = ["Client Info", "Property & Loss", "Insurance", "Documents", "Review & Submit"];

const CASE_TYPES = [
  "First Party Property",
  "Third Party Property",
  "Personal Injury",
  "Bad Faith",
  "Liability",
  "Other",
];

const JURISDICTIONS = [
  "Kentucky - State",
  "Kentucky - Federal",
  "Tennessee - State",
  "Tennessee - Federal",
  "Florida - State",
  "Florida - Federal (S.D. Fla.)",
  "Florida - Federal (M.D. Fla.)",
  "Florida - Federal (N.D. Fla.)",
  "Georgia - State",
  "Georgia - Federal",
  "Texas - State",
  "Texas - Federal",
  "Montana - State",
  "Montana - Federal",
  "Other",
];

const CAUSES_OF_LOSS = [
  "Hurricane/Wind",
  "Water Damage",
  "Fire",
  "Hail",
  "Flood",
  "Mold",
  "Theft",
  "Vandalism",
  "Sinkhole",
  "Collapse",
  "Lightning",
  "Other",
];

const DOC_CATEGORIES = [
  "Photos",
  "Denial Letters",
  "Estimates",
  "Policy Documents",
  "Correspondence",
  "Other",
];

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  backgroundColor: INPUT_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  color: TEXT,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif",
};

const labelStyle = {
  display: "block",
  marginBottom: 4,
  fontSize: 12,
  color: GOLD,
  fontWeight: 600,
};

const fieldWrap = { marginBottom: 14 };

const errStyle = { color: DANGER, fontSize: 11, marginTop: 2 };

export default function CaseIntakeForm({ onClose, onCreated, onNavigateToCase, teamMembers: teamProp }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [errors, setErrors] = useState({});
  const [insurers, setInsurers] = useState([]);
  const [teamMembers, setTeamMembers] = useState(teamProp || []);
  const [insurerQuery, setInsurerQuery] = useState("");
  const [showInsurerDropdown, setShowInsurerDropdown] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [conflictChecking, setConflictChecking] = useState(false);
  const [conflictDismissed, setConflictDismissed] = useState(false);

  // Document upload state
  const [files, setFiles] = useState([]); // { file, category, preview? }
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    client_address: "",
    property_address: "",
    date_of_loss: "",
    cause_of_loss: "",
    damage_description: "",
    type: "",
    insurer: "",
    claim_number: "",
    policy_number: "",
    adjuster_name: "",
    adjuster_phone: "",
    adjuster_email: "",
    date_reported: "",
    date_denied: "",
    jurisdiction: "",
    attorney_id: "",
    support_id: "",
  });

  useEffect(() => {
    fetch("/api/cases/search?q=_&limit=500")
      .then((r) => r.json())
      .then((cases) => {
        if (Array.isArray(cases)) {
          const unique = [...new Set(cases.map((c) => c.insurer).filter(Boolean))].sort();
          setInsurers(unique);
        }
      })
      .catch(() => {});

    if (!teamProp || teamProp.length === 0) {
      fetch("/api/portal")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setTeamMembers(d);
          else if (d?.team_members) setTeamMembers(d.team_members);
        })
        .catch(() => {});
    }
  }, [teamProp]);

  const set = (field, val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  // Conflict check
  const runConflictCheck = useCallback(async () => {
    if (!form.client_name.trim() && !form.property_address.trim()) return;
    setConflictChecking(true);
    try {
      const res = await fetch("/api/cases/conflict-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: form.client_name,
          property_address: form.property_address,
          insurer: form.insurer,
          claim_number: form.claim_number,
        }),
      });
      const data = await res.json();
      if (data.conflicts?.length) {
        setConflicts(data.conflicts);
        setConflictDismissed(false);
      } else {
        setConflicts([]);
      }
    } catch {}
    setConflictChecking(false);
  }, [form.client_name, form.property_address, form.insurer, form.claim_number]);

  // Run conflict check when leaving step 0 or 1
  useEffect(() => {
    if (step === 1 && form.client_name.trim()) {
      const t = setTimeout(runConflictCheck, 500);
      return () => clearTimeout(t);
    }
  }, [step, runConflictCheck]);

  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.client_name.trim()) e.client_name = "Client name is required";
      if (form.client_phone && !/^[\d\s()+-]{7,20}$/.test(form.client_phone)) e.client_phone = "Invalid phone format";
      if (form.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email)) e.client_email = "Invalid email format";
    }
    if (step === 2) {
      if (form.adjuster_phone && !/^[\d\s()+-]{7,20}$/.test(form.adjuster_phone)) e.adjuster_phone = "Invalid phone format";
      if (form.adjuster_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adjuster_email)) e.adjuster_email = "Invalid email format";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // File handling
  const addFiles = useCallback((newFiles) => {
    const additions = Array.from(newFiles).map((file) => {
      const isImage = file.type.startsWith("image/");
      return {
        file,
        category: guessCategory(file.name),
        preview: isImage ? URL.createObjectURL(file) : null,
      };
    });
    setFiles((prev) => [...prev, ...additions]);
  }, []);

  const removeFile = (idx) => {
    setFiles((prev) => {
      const removed = prev[idx];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateFileCategory = (idx, category) => {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, category } : f)));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Build payload
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== "" && v !== null) payload[k] = v;
      }

      const res = await fetch("/api/cases/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create case");

      const caseId = data.id;
      const caseRef = data.ref;

      // Upload documents if any
      let uploadedCount = 0;
      if (files.length > 0 && caseId) {
        for (const f of files) {
          try {
            const formData = new FormData();
            formData.append("file", f.file);
            formData.append("case_id", caseId);
            formData.append("category", f.category || "Intake");
            const uploadRes = await fetch("/api/docs", { method: "POST", body: formData });
            if (uploadRes.ok) uploadedCount++;
          } catch (uploadErr) {
            console.error("Failed to upload:", f.file.name, uploadErr);
          }
        }
      }

      setSuccessData({ caseRef, caseId, uploadedCount, totalFiles: files.length });
      onCreated?.(data);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInsurers = insurers.filter((i) =>
    i.toLowerCase().includes(insurerQuery.toLowerCase())
  );

  const attorneys = teamMembers.filter((m) =>
    ["Attorney", "Partner", "Managing Partner", "Of Counsel"].includes(m.role || m.title)
  );
  const support = teamMembers.filter((m) =>
    ["Paralegal", "Legal Assistant", "Case Manager", "Support"].includes(m.role || m.title)
  );

  const renderField = (label, field, opts = {}) => (
    <div style={fieldWrap}>
      <label style={labelStyle}>
        {label}
        {opts.required && <span style={{ color: DANGER }}> *</span>}
      </label>
      {opts.type === "select" ? (
        <select style={inputStyle} value={form[field]} onChange={(e) => set(field, e.target.value)}>
          <option value="">Select...</option>
          {(opts.options || []).map((o) => (
            <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : opts.type === "textarea" ? (
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
          placeholder={opts.placeholder}
        />
      ) : (
        <input
          style={inputStyle}
          type={opts.type || "text"}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
          placeholder={opts.placeholder}
        />
      )}
      {errors[field] && <div style={errStyle}>{errors[field]}</div>}
    </div>
  );

  const renderInsurer = () => (
    <div style={{ ...fieldWrap, position: "relative" }}>
      <label style={labelStyle}>Insurance Company</label>
      <input
        style={inputStyle}
        value={form.insurer}
        onChange={(e) => {
          set("insurer", e.target.value);
          setInsurerQuery(e.target.value);
          setShowInsurerDropdown(true);
        }}
        onFocus={() => setShowInsurerDropdown(true)}
        onBlur={() => setTimeout(() => setShowInsurerDropdown(false), 200)}
        placeholder="Start typing to search..."
      />
      {showInsurerDropdown && insurerQuery && filteredInsurers.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            maxHeight: 160,
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          {filteredInsurers.slice(0, 8).map((ins) => (
            <div
              key={ins}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 13,
                color: TEXT,
                borderBottom: `1px solid ${BORDER}`,
              }}
              onMouseDown={() => {
                set("insurer", ins);
                setInsurerQuery(ins);
                setShowInsurerDropdown(false);
              }}
            >
              {ins}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Success screen
  if (successData) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: CARD_BG,
            borderRadius: 12,
            width: "100%",
            maxWidth: 480,
            border: `1px solid ${BORDER}`,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: GREEN, marginBottom: 8 }}>
            Case Created Successfully
          </h2>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 24,
              fontWeight: 800,
              color: GOLD,
              marginBottom: 16,
              padding: "12px 24px",
              background: `${GOLD}10`,
              borderRadius: 8,
              display: "inline-block",
              border: `1px solid ${GOLD}30`,
            }}
          >
            {successData.caseRef}
          </div>
          <div style={{ fontSize: 13, color: TEXT_M, marginBottom: 8 }}>
            Case reference number assigned
          </div>
          {successData.totalFiles > 0 && (
            <div style={{ fontSize: 13, color: TEXT_M, marginBottom: 20 }}>
              📄 {successData.uploadedCount}/{successData.totalFiles} document{successData.totalFiles !== 1 ? "s" : ""} uploaded
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button
              onClick={() => {
                if (onNavigateToCase && successData.caseId) {
                  onNavigateToCase(successData.caseId);
                }
                onClose?.();
              }}
              style={{
                padding: "10px 24px",
                backgroundColor: NAVY,
                border: `1px solid ${GOLD}`,
                borderRadius: 6,
                color: GOLD,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              View Case
            </button>
            <button
              onClick={() => {
                setSuccessData(null);
                setStep(0);
                setForm({
                  client_name: "", client_phone: "", client_email: "", client_address: "",
                  property_address: "", date_of_loss: "", cause_of_loss: "", damage_description: "",
                  type: "", insurer: "", claim_number: "", policy_number: "",
                  adjuster_name: "", adjuster_phone: "", adjuster_email: "",
                  date_reported: "", date_denied: "", jurisdiction: "",
                  attorney_id: "", support_id: "",
                });
                setFiles([]);
              }}
              style={{
                padding: "10px 24px",
                backgroundColor: "transparent",
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                color: TEXT_M,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              👤 Client Information
            </h3>
            {renderField("Client Name", "client_name", { required: true, placeholder: "Full name" })}
            {renderField("Phone", "client_phone", { type: "tel", placeholder: "(555) 555-5555" })}
            {renderField("Email", "client_email", { type: "email", placeholder: "client@email.com" })}
            {renderField("Client Address", "client_address", { placeholder: "123 Main St, City, State ZIP" })}
          </>
        );
      case 1:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              🏠 Property & Loss Details
            </h3>
            {renderField("Property Address", "property_address", { placeholder: "123 Main St, City, State ZIP" })}
            {renderField("Date of Loss", "date_of_loss", { type: "date" })}
            {renderField("Cause of Loss", "cause_of_loss", { type: "select", options: CAUSES_OF_LOSS })}
            {renderField("Case Type", "type", { type: "select", options: CASE_TYPES })}
            {renderField("Description of Damage", "damage_description", {
              type: "textarea",
              placeholder: "Describe the damage to the property in detail...",
            })}
            {renderField("Jurisdiction", "jurisdiction", { type: "select", options: JURISDICTIONS })}
          </>
        );
      case 2:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              🛡️ Insurance Information
            </h3>
            {renderInsurer()}
            {renderField("Policy Number", "policy_number", { placeholder: "POL-000000" })}
            {renderField("Claim Number", "claim_number", { placeholder: "CLM-000000" })}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>{renderField("Date Reported", "date_reported", { type: "date" })}</div>
              <div>{renderField("Date Denied", "date_denied", { type: "date" })}</div>
            </div>
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, marginTop: 6 }}>
              <div style={{ fontSize: 12, color: TEXT_D, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Adjuster Information
              </div>
              {renderField("Adjuster Name", "adjuster_name", { placeholder: "Adjuster full name" })}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>{renderField("Adjuster Phone", "adjuster_phone", { type: "tel", placeholder: "(555) 555-5555" })}</div>
                <div>{renderField("Adjuster Email", "adjuster_email", { type: "email", placeholder: "adjuster@insurer.com" })}</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, marginTop: 6 }}>
              <div style={{ fontSize: 12, color: TEXT_D, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Assignment (Optional)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  {renderField("Attorney", "attorney_id", {
                    type: "select",
                    options: attorneys.map((m) => ({ value: m.id, label: m.name })),
                  })}
                </div>
                <div>
                  {renderField("Support Staff", "support_id", {
                    type: "select",
                    options: support.length > 0
                      ? support.map((m) => ({ value: m.id, label: m.name }))
                      : teamMembers.map((m) => ({ value: m.id, label: `${m.name} (${m.role || m.title || ""})` })),
                  })}
                </div>
              </div>
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              📄 Document Upload
            </h3>
            <p style={{ fontSize: 12, color: TEXT_M, marginBottom: 16 }}>
              Upload photos of damage, denial letters, estimates, policy documents, and any other relevant files.
              You can also skip this step and upload documents later.
            </p>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? GOLD : BORDER_L}`,
                borderRadius: 10,
                padding: "32px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? `${GOLD}08` : `${INPUT_BG}80`,
                transition: "all 0.2s ease",
                marginBottom: 16,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.msg,.eml,.txt"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
              <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: dragOver ? GOLD : TEXT, marginBottom: 4 }}>
                {dragOver ? "Drop files here" : "Drag & drop files or click to browse"}
              </div>
              <div style={{ fontSize: 11, color: TEXT_D }}>
                PDF, Word, Excel, images, emails — up to 50MB each
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: TEXT_M, marginBottom: 8, fontWeight: 600 }}>
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </div>
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: INPUT_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      marginBottom: 6,
                    }}
                  >
                    {f.preview ? (
                      <img
                        src={f.preview}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 20, width: 32, textAlign: "center" }}>
                        {fileIcon(f.file.name)}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.file.name}
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_D }}>
                        {formatSize(f.file.size)}
                      </div>
                    </div>
                    <select
                      value={f.category}
                      onChange={(e) => updateFileCategory(i, e.target.value)}
                      style={{ ...inputStyle, width: 140, padding: "4px 8px", fontSize: 11 }}
                    >
                      {DOC_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: DANGER,
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "4px 8px",
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      case 4:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              ✓ Review & Submit
            </h3>

            {/* Conflict Warning */}
            {conflicts.length > 0 && !conflictDismissed && (
              <div style={{
                padding: 14, marginBottom: 16, borderRadius: 8,
                background: `${DANGER}12`, border: `1px solid ${DANGER}40`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DANGER }}>⚠️ Potential Conflicts Found</div>
                  <button onClick={() => setConflictDismissed(true)} style={{ background: "transparent", border: "none", color: TEXT_D, cursor: "pointer", fontSize: 12 }}>Dismiss</button>
                </div>
                {conflicts.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: TEXT, padding: "4px 0", borderBottom: i < conflicts.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <strong style={{ color: GOLD }}>{c.ref}</strong> — {c.client_name} ({c.status}) — matched by {c.match_type === "client_name" ? "client name" : c.match_type === "property_address" ? "property address" : "insurer/claim #"}
                  </div>
                ))}
                <div style={{ fontSize: 11, color: TEXT_D, marginTop: 8 }}>Review these cases before creating a duplicate. You can still proceed if this is a new matter.</div>
              </div>
            )}

            <p style={{ fontSize: 12, color: TEXT_M, marginBottom: 16 }}>
              Please review the information below before submitting. A case reference number will be automatically assigned.
            </p>

            {/* Client Info */}
            <ReviewSection title="👤 Client Info">
              <ReviewRow label="Client Name" value={form.client_name} />
              <ReviewRow label="Phone" value={form.client_phone} />
              <ReviewRow label="Email" value={form.client_email} />
              <ReviewRow label="Client Address" value={form.client_address} />
            </ReviewSection>

            {/* Property & Loss */}
            <ReviewSection title="🏠 Property & Loss">
              <ReviewRow label="Property Address" value={form.property_address} />
              <ReviewRow label="Date of Loss" value={form.date_of_loss} />
              <ReviewRow label="Cause of Loss" value={form.cause_of_loss} />
              <ReviewRow label="Case Type" value={form.type} />
              <ReviewRow label="Jurisdiction" value={form.jurisdiction} />
              {form.damage_description && (
                <div style={{ padding: "8px 12px", background: INPUT_BG, borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: TEXT_D, marginBottom: 2 }}>Description of Damage</div>
                  <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{form.damage_description}</div>
                </div>
              )}
            </ReviewSection>

            {/* Insurance */}
            <ReviewSection title="🛡️ Insurance">
              <ReviewRow label="Insurer" value={form.insurer} />
              <ReviewRow label="Policy #" value={form.policy_number} />
              <ReviewRow label="Claim #" value={form.claim_number} />
              <ReviewRow label="Date Reported" value={form.date_reported} />
              <ReviewRow label="Date Denied" value={form.date_denied} />
              <ReviewRow label="Adjuster" value={form.adjuster_name} />
              <ReviewRow label="Adjuster Phone" value={form.adjuster_phone} />
              <ReviewRow label="Adjuster Email" value={form.adjuster_email} />
              <ReviewRow label="Attorney" value={attorneys.find((a) => a.id == form.attorney_id)?.name} />
              <ReviewRow label="Support" value={teamMembers.find((m) => m.id == form.support_id)?.name} />
            </ReviewSection>

            {/* Documents */}
            {files.length > 0 && (
              <ReviewSection title="📄 Documents">
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "6px 12px",
                      background: INPUT_BG,
                      borderRadius: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{fileIcon(f.file.name)}</span>
                    <span style={{ fontSize: 12, color: TEXT, flex: 1 }}>{f.file.name}</span>
                    <span style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: `${GOLD}15`,
                      color: GOLD,
                    }}>{f.category}</span>
                  </div>
                ))}
              </ReviewSection>
            )}

            {submitError && (
              <div style={{
                ...errStyle,
                marginTop: 16,
                padding: 12,
                backgroundColor: `${DANGER}12`,
                borderRadius: 6,
                border: `1px solid ${DANGER}30`,
              }}>
                ❌ {submitError}
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 12,
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflow: "auto",
          border: `1px solid ${BORDER}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: TEXT }}>
              📥 New Case Intake
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: TEXT_D,
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>
          {/* Step indicators */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <div
                key={s}
                onClick={() => { if (i < step) setStep(i); }}
                style={{
                  fontSize: 11,
                  color: i === step ? GOLD : i < step ? GREEN : TEXT_D,
                  fontWeight: i === step ? 700 : 400,
                  textAlign: "center",
                  flex: 1,
                  cursor: i < step ? "pointer" : "default",
                }}
              >
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  marginBottom: 4,
                  background: i < step ? GREEN : i === step ? GOLD : "transparent",
                  color: i <= step ? "#000" : TEXT_D,
                  border: `1px solid ${i < step ? GREEN : i === step ? GOLD : BORDER_L}`,
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <div>{s}</div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 3,
              backgroundColor: BORDER,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                backgroundColor: step === STEPS.length - 1 ? GREEN : GOLD,
                borderRadius: 2,
                transition: "width 0.3s ease, background-color 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px" }}>{renderStep()}</div>

        {/* Footer buttons */}
        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <button
            onClick={step === 0 ? onClose : back}
            style={{
              padding: "10px 24px",
              backgroundColor: "transparent",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: TEXT_M,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              style={{
                padding: "10px 24px",
                backgroundColor: NAVY,
                border: `1px solid ${GOLD}`,
                borderRadius: 6,
                color: GOLD,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              style={{
                padding: "10px 32px",
                backgroundColor: GREEN,
                border: "none",
                borderRadius: 6,
                color: "#fff",
                cursor: submitting ? "wait" : "pointer",
                fontSize: 14,
                fontWeight: 700,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Creating Case..." : "✓ Create Case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
function ReviewSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#ebb003", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ padding: "6px 12px", background: "#0a0a14", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "#55556a", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#e8e8f0" }}>{value || "—"}</div>
    </div>
  );
}

function guessCategory(filename) {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|tiff)$/i.test(lower)) return "Photos";
  if (/denial|deny|denied/i.test(lower)) return "Denial Letters";
  if (/estimate|scope|xactimate/i.test(lower)) return "Estimates";
  if (/policy|dec\s?page|declaration/i.test(lower)) return "Policy Documents";
  return "Other";
}

function fileIcon(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx"].includes(ext)) return "📗";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "tiff"].includes(ext)) return "🖼️";
  if (["msg", "eml"].includes(ext)) return "📧";
  return "📄";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
