"use client";
import { useState, useEffect } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const DARK_BG = "#0a0a1a";
const CARD_BG = "#111133";
const INPUT_BG = "#1a1a3a";
const BORDER = "#333366";
const TEXT = "#e0e0e0";
const TEXT_DIM = "#999";

const STEPS = ["Client Info", "Property & Loss", "Insurance", "Legal", "Review & Submit"];

const CASE_TYPES = [
  "First Party Property",
  "Third Party Property",
  "Personal Injury",
  "Bad Faith",
  "Liability",
  "Other",
];

const JURISDICTIONS = [
  "Florida - State",
  "Florida - Federal (S.D. Fla.)",
  "Florida - Federal (M.D. Fla.)",
  "Florida - Federal (N.D. Fla.)",
  "Georgia - State",
  "Georgia - Federal",
  "Texas - State",
  "Texas - Federal",
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

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  backgroundColor: INPUT_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  color: TEXT,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  marginBottom: 4,
  fontSize: 13,
  color: GOLD,
  fontWeight: 600,
};

const fieldWrap = { marginBottom: 16 };

const errStyle = { color: "#ff6b6b", fontSize: 12, marginTop: 2 };

export default function CaseIntakeForm({ onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [errors, setErrors] = useState({});
  const [insurers, setInsurers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [insurerQuery, setInsurerQuery] = useState("");
  const [showInsurerDropdown, setShowInsurerDropdown] = useState(false);

  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    property_address: "",
    date_of_loss: "",
    cause_of_loss: "",
    type: "",
    insurer: "",
    claim_number: "",
    policy_number: "",
    adjuster_name: "",
    adjuster_phone: "",
    adjuster_email: "",
    jurisdiction: "",
    statute_of_limitations: "",
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

    fetch("/api/portal")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTeamMembers(d);
        else if (d?.team_members) setTeamMembers(d.team_members);
      })
      .catch(() => {});
  }, []);

  const set = (field, val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (step === 0 && !form.client_name.trim()) e.client_name = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
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
      onCreated?.(data);
      onClose?.();
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
        {opts.required && <span style={{ color: "#ff6b6b" }}> *</span>}
      </label>
      {opts.type === "select" ? (
        <select
          style={inputStyle}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
        >
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

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px" }}>Client Information</h3>
            {renderField("Client Name", "client_name", { required: true, placeholder: "Full name" })}
            {renderField("Phone", "client_phone", { type: "tel", placeholder: "(555) 555-5555" })}
            {renderField("Email", "client_email", { type: "email", placeholder: "client@email.com" })}
          </>
        );
      case 1:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px" }}>Property & Loss Details</h3>
            {renderField("Property Address", "property_address", { placeholder: "123 Main St, City, FL 33101" })}
            {renderField("Date of Loss", "date_of_loss", { type: "date" })}
            {renderField("Cause of Loss", "cause_of_loss", { type: "select", options: CAUSES_OF_LOSS })}
            {renderField("Case Type", "type", { type: "select", options: CASE_TYPES })}
          </>
        );
      case 2:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px" }}>Insurance Information</h3>
            {renderInsurer()}
            {renderField("Claim Number", "claim_number", { placeholder: "CLM-000000" })}
            {renderField("Policy Number", "policy_number", { placeholder: "POL-000000" })}
            {renderField("Adjuster Name", "adjuster_name", { placeholder: "Adjuster full name" })}
            {renderField("Adjuster Phone", "adjuster_phone", { type: "tel", placeholder: "(555) 555-5555" })}
            {renderField("Adjuster Email", "adjuster_email", { type: "email", placeholder: "adjuster@insurer.com" })}
          </>
        );
      case 3:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px" }}>Legal Details</h3>
            {renderField("Jurisdiction", "jurisdiction", { type: "select", options: JURISDICTIONS })}
            {renderField("Statute of Limitations", "statute_of_limitations", { type: "date" })}
            {renderField("Assigned Attorney", "attorney_id", {
              type: "select",
              options: attorneys.map((m) => ({ value: m.id, label: m.name })),
            })}
            {renderField("Support Staff", "support_id", {
              type: "select",
              options: support.length > 0
                ? support.map((m) => ({ value: m.id, label: m.name }))
                : teamMembers.map((m) => ({ value: m.id, label: `${m.name} (${m.role || m.title || ""})` })),
            })}
          </>
        );
      case 4:
        return (
          <>
            <h3 style={{ color: GOLD, margin: "0 0 16px" }}>Review & Submit</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Client", form.client_name],
                ["Phone", form.client_phone],
                ["Email", form.client_email],
                ["Address", form.property_address],
                ["Date of Loss", form.date_of_loss],
                ["Cause", form.cause_of_loss],
                ["Type", form.type],
                ["Insurer", form.insurer],
                ["Claim #", form.claim_number],
                ["Policy #", form.policy_number],
                ["Adjuster", form.adjuster_name],
                ["Jurisdiction", form.jurisdiction],
                ["SOL", form.statute_of_limitations],
                ["Attorney", attorneys.find((a) => a.id == form.attorney_id)?.name || "—"],
                ["Support", teamMembers.find((m) => m.id == form.support_id)?.name || "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: "8px 12px", backgroundColor: INPUT_BG, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: TEXT }}>{val || "—"}</div>
                </div>
              ))}
            </div>
            {submitError && (
              <div style={{ ...errStyle, marginTop: 16, padding: 10, backgroundColor: "#3a1111", borderRadius: 6 }}>
                {submitError}
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
          maxWidth: 600,
          maxHeight: "90vh",
          overflow: "auto",
          border: `1px solid ${BORDER}`,
        }}
      >
        {/* Progress Bar */}
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <div
                key={s}
                style={{
                  fontSize: 11,
                  color: i === step ? GOLD : i < step ? GREEN : TEXT_DIM,
                  fontWeight: i === step ? 700 : 400,
                  textAlign: "center",
                  flex: 1,
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div
            style={{
              height: 4,
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
        <div style={{ padding: 24 }}>{renderStep()}</div>

        {/* Buttons */}
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
              color: TEXT,
              cursor: "pointer",
              fontSize: 14,
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
                fontSize: 14,
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
              {submitting ? "Creating..." : "✓ Create Case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
