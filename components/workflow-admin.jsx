"use client";

import { useState, useEffect, useCallback } from "react";

const COLORS = {
  bg: "#08080f", card: "#111119", border: "#1e1e2e",
  gold: "#ebb003", text: "#e8e8f0", muted: "#8888a0",
  navy: "#000066", green: "#386f4a", red: "#a03030",
  inputBg: "#1a1a28",
};

const TRIGGER_EVENTS = [
  "atr_sent", "lor_sent", "demand_served", "complaint_filed",
  "defendant_served", "discovery_received", "discovery_served",
  "counterclaim_received", "settlement_sent", "client_callback",
];

const JURISDICTIONS = [
  "ALL", "KY", "IN", "MT", "TN", "AZ", "OH", "TX", "OR", "ID", "WY", "SD", "SC", "OK", "NV", "IL", "FL",
];

const DOC_CATEGORIES = ["LOR", "Complaint", "Discovery", "Demand", "Contract", "POL", "Settlement", "Other"];

const PHASES = ["Presuit", "Presuit Demand", "Litigation - Filed", "Litigation - Discovery", "Litigation - Mediation", "Litigation - Trial Prep", "Appraisal", "Settled", "Closed"];

const ACTION_TYPES = ["calendar_event", "follow_up", "alert"];

// ─── Styles ──────────────────────────────────
const styles = {
  container: { background: COLORS.bg, color: COLORS.text, minHeight: "100vh", padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif" },
  tabs: { display: "flex", gap: "4px", marginBottom: "24px", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: "0" },
  tab: (active) => ({
    padding: "10px 20px", cursor: "pointer", border: "none", borderBottom: active ? `2px solid ${COLORS.gold}` : "2px solid transparent",
    background: "none", color: active ? COLORS.gold : COLORS.muted, fontWeight: active ? 600 : 400, fontSize: "14px",
  }),
  card: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "16px", marginBottom: "12px" },
  btn: (color = COLORS.gold) => ({
    padding: "6px 14px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
    background: color, color: color === COLORS.gold ? "#000" : "#fff",
  }),
  btnSm: (color = COLORS.gold) => ({
    padding: "3px 10px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
    background: color, color: color === COLORS.gold ? "#000" : "#fff",
  }),
  input: { padding: "6px 10px", border: `1px solid ${COLORS.border}`, borderRadius: "4px", background: COLORS.inputBg, color: COLORS.text, fontSize: "13px", width: "100%" },
  select: { padding: "6px 10px", border: `1px solid ${COLORS.border}`, borderRadius: "4px", background: COLORS.inputBg, color: COLORS.text, fontSize: "13px" },
  badge: (bg) => ({ display: "inline-block", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, background: bg, color: "#fff", marginRight: "4px" }),
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase" },
  td: { padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` },
  chip: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", background: COLORS.navy, color: "#fff", margin: "2px" },
  toast: (type) => ({
    position: "fixed", bottom: "24px", right: "24px", padding: "12px 20px", borderRadius: "8px", zIndex: 9999, fontSize: "14px", fontWeight: 500,
    background: type === "error" ? COLORS.red : COLORS.green, color: "#fff",
  }),
  filterBar: { display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" },
};

// ─── Toast ───────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return <div style={styles.toast(type)}>{message}</div>;
}

// ─── Confirm Dialog ──────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ ...styles.card, maxWidth: "400px", textAlign: "center" }}>
        <p style={{ marginBottom: "16px" }}>{message}</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button style={styles.btn(COLORS.red)} onClick={onConfirm}>Delete</button>
          <button style={styles.btn(COLORS.muted)} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Editable Cell ───────────────────────────
function EditableCell({ value, onSave, type = "text", options = [] }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  useEffect(() => setVal(value), [value]);

  if (!editing) {
    return <span onClick={() => setEditing(true)} style={{ cursor: "pointer", borderBottom: `1px dashed ${COLORS.border}` }}>{String(value ?? "—")}</span>;
  }

  const save = () => { setEditing(false); if (val !== value) onSave(val); };

  if (type === "select") {
    return <select style={styles.select} value={val} onChange={(e) => { setVal(e.target.value); }} onBlur={save} autoFocus>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
  }
  if (type === "number") {
    return <input style={{ ...styles.input, width: "60px" }} type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()} autoFocus />;
  }
  return <input style={styles.input} value={val || ""} onChange={(e) => setVal(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()} autoFocus />;
}

// ═══════════════════════════════════════════════
// TAB 1: Workflow Templates
// ═══════════════════════════════════════════════
function WorkflowTemplatesTab({ showToast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterPhase, setFilterPhase] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("case_type", filterType);
    if (filterPhase) params.set("phase", filterPhase);
    const res = await fetch(`/api/workflow-templates?${params}`);
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filterType, filterPhase]);

  useEffect(() => { load(); }, [load]);

  const update = async (id, field, value) => {
    const res = await fetch(`/api/workflow-templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    if (res.ok) { showToast("Updated", "success"); load(); } else { showToast("Update failed", "error"); }
  };

  const addTemplate = async (phase, case_type) => {
    const maxOrder = templates.filter((t) => t.phase === phase && t.case_type === case_type).reduce((m, t) => Math.max(m, t.task_order || 0), 0);
    const res = await fetch("/api/workflow-templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", phase, case_type, task_order: maxOrder + 1, role: "paralegal", is_gate: false, required_docs: [] }),
    });
    if (res.ok) { showToast("Task added", "success"); load(); } else { showToast("Failed to add", "error"); }
  };

  const deleteTemplate = async (id) => {
    const res = await fetch(`/api/workflow-templates/${id}`, { method: "DELETE" });
    if (res.ok) { showToast("Deleted", "success"); load(); } else { showToast("Delete failed", "error"); }
    setConfirmDelete(null);
  };

  const moveOrder = async (item, direction) => {
    const newOrder = (item.task_order || 0) + direction;
    if (newOrder < 1) return;
    await update(item.id, "task_order", newOrder);
  };

  const addDoc = async (id, currentDocs, doc) => {
    if (!doc || (currentDocs || []).includes(doc)) return;
    await update(id, "required_docs", [...(currentDocs || []), doc]);
  };

  const removeDoc = async (id, currentDocs, doc) => {
    await update(id, "required_docs", (currentDocs || []).filter((d) => d !== doc));
  };

  // Group by case_type → phase
  const grouped = {};
  templates.forEach((t) => {
    const key = `${t.case_type}|||${t.phase}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  if (loading) return <div style={{ color: COLORS.muted, padding: "40px", textAlign: "center" }}>Loading templates...</div>;

  return (
    <div>
      <div style={styles.filterBar}>
        <select style={styles.select} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Case Types</option>
          <option value="property">Property</option>
          <option value="pi">PI</option>
        </select>
        <select style={styles.select} value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)}>
          <option value="">All Phases</option>
          {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {Object.entries(grouped).map(([key, items]) => {
        const [caseType, phase] = key.split("|||");
        return (
          <div key={key} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <span style={styles.badge(COLORS.navy)}>{caseType}</span>
                <span style={styles.badge(COLORS.green)}>{phase}</span>
              </div>
              <button style={styles.btnSm()} onClick={() => addTemplate(phase, caseType)}>+ Add Task</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Gate</th>
                  <th style={styles.th}>SOP</th>
                  <th style={styles.th}>Required Docs</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.sort((a, b) => (a.task_order || 0) - (b.task_order || 0)).map((t) => (
                  <tr key={t.id}>
                    <td style={styles.td}>
                      <EditableCell value={t.task_order} type="number" onSave={(v) => update(t.id, "task_order", v)} />
                    </td>
                    <td style={styles.td}><EditableCell value={t.title} onSave={(v) => update(t.id, "title", v)} /></td>
                    <td style={styles.td}><EditableCell value={t.description} onSave={(v) => update(t.id, "description", v)} /></td>
                    <td style={styles.td}>
                      <EditableCell value={t.role} type="select" options={["attorney", "paralegal", "admin", "investigator"]} onSave={(v) => update(t.id, "role", v)} />
                    </td>
                    <td style={styles.td}>
                      <button style={styles.btnSm(t.is_gate ? COLORS.gold : COLORS.muted)} onClick={() => update(t.id, "is_gate", !t.is_gate)}>
                        {t.is_gate ? "GATE" : "—"}
                      </button>
                    </td>
                    <td style={styles.td}><EditableCell value={t.sop_reference} onSave={(v) => update(t.id, "sop_reference", v)} /></td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
                        {(t.required_docs || []).map((d) => (
                          <span key={d} style={styles.chip}>{d} <span onClick={() => removeDoc(t.id, t.required_docs, d)} style={{ cursor: "pointer", marginLeft: "2px" }}>×</span></span>
                        ))}
                        <input style={{ ...styles.input, width: "80px", fontSize: "11px" }} placeholder="+ doc" onKeyDown={(e) => { if (e.key === "Enter") { addDoc(t.id, t.required_docs, e.target.value); e.target.value = ""; } }} />
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button style={styles.btnSm(COLORS.muted)} onClick={() => moveOrder(t, -1)}>↑</button>
                        <button style={styles.btnSm(COLORS.muted)} onClick={() => moveOrder(t, 1)}>↓</button>
                        <button style={styles.btnSm(COLORS.red)} onClick={() => setConfirmDelete(t.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {templates.length === 0 && <div style={{ color: COLORS.muted, textAlign: "center", padding: "40px" }}>No templates found. Add some to get started.</div>}
      {confirmDelete && <ConfirmDialog message="Delete this workflow template?" onConfirm={() => deleteTemplate(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 2: Deadline Rules
// ═══════════════════════════════════════════════
function DeadlineRulesTab({ showToast }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState({ trigger_event: "atr_sent", days: 30, jurisdiction: "ALL", action_type: "create_task", action_label: "", is_recurring: false, recur_interval_days: null });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/deadline-rules");
    const data = await res.json();
    setRules(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id, field, value) => {
    const res = await fetch(`/api/deadline-rules/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    if (res.ok) { showToast("Updated", "success"); load(); } else { showToast("Update failed", "error"); }
  };

  const addRule = async () => {
    const res = await fetch("/api/deadline-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRule) });
    if (res.ok) { showToast("Rule added", "success"); setAdding(false); setNewRule({ trigger_event: "atr_sent", days: 30, jurisdiction: "ALL", action_type: "create_task", action_label: "", is_recurring: false, recur_interval_days: null }); load(); }
    else { showToast("Failed to add rule", "error"); }
  };

  const deleteRule = async (id) => {
    const res = await fetch(`/api/deadline-rules/${id}`, { method: "DELETE" });
    if (res.ok) { showToast("Deleted", "success"); load(); } else { showToast("Delete failed", "error"); }
    setConfirmDelete(null);
  };

  if (loading) return <div style={{ color: COLORS.muted, padding: "40px", textAlign: "center" }}>Loading rules...</div>;

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <button style={styles.btn()} onClick={() => setAdding(!adding)}>+ Add Rule</button>
      </div>

      {adding && (
        <div style={{ ...styles.card, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Trigger Event</label>
            <select style={{ ...styles.select, width: "100%" }} value={newRule.trigger_event} onChange={(e) => setNewRule({ ...newRule, trigger_event: e.target.value })}>
              {TRIGGER_EVENTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Days</label>
            <input style={styles.input} type="number" value={newRule.days} onChange={(e) => setNewRule({ ...newRule, days: Number(e.target.value) })} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Jurisdiction</label>
            <select style={{ ...styles.select, width: "100%" }} value={newRule.jurisdiction} onChange={(e) => setNewRule({ ...newRule, jurisdiction: e.target.value })}>
              {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Action Type</label>
            <select style={{ ...styles.select, width: "100%" }} value={newRule.action_type} onChange={(e) => setNewRule({ ...newRule, action_type: e.target.value })}>
              {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Action Label</label>
            <input style={styles.input} value={newRule.action_label} onChange={(e) => setNewRule({ ...newRule, action_label: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted, display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={newRule.is_recurring} onChange={(e) => setNewRule({ ...newRule, is_recurring: e.target.checked })} /> Recurring
            </label>
            {newRule.is_recurring && <input style={styles.input} type="number" placeholder="Interval days" value={newRule.recur_interval_days || ""} onChange={(e) => setNewRule({ ...newRule, recur_interval_days: Number(e.target.value) || null })} />}
          </div>
          <div><button style={styles.btn()} onClick={addRule}>Save</button></div>
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Trigger</th>
            <th style={styles.th}>Days</th>
            <th style={styles.th}>Jurisdiction</th>
            <th style={styles.th}>Action Type</th>
            <th style={styles.th}>Label</th>
            <th style={styles.th}>Recurring</th>
            <th style={styles.th}>Interval</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td style={styles.td}><EditableCell value={r.trigger_event} type="select" options={TRIGGER_EVENTS} onSave={(v) => update(r.id, "trigger_event", v)} /></td>
              <td style={styles.td}><EditableCell value={r.days} type="number" onSave={(v) => update(r.id, "days", v)} /></td>
              <td style={styles.td}><EditableCell value={r.jurisdiction} type="select" options={JURISDICTIONS} onSave={(v) => update(r.id, "jurisdiction", v)} /></td>
              <td style={styles.td}><EditableCell value={r.action_type} type="select" options={ACTION_TYPES} onSave={(v) => update(r.id, "action_type", v)} /></td>
              <td style={styles.td}><EditableCell value={r.action_label} onSave={(v) => update(r.id, "action_label", v)} /></td>
              <td style={styles.td}>
                <button style={styles.btnSm(r.is_recurring ? COLORS.green : COLORS.muted)} onClick={() => update(r.id, "is_recurring", !r.is_recurring)}>
                  {r.is_recurring ? "Yes" : "No"}
                </button>
              </td>
              <td style={styles.td}><EditableCell value={r.recur_interval_days} type="number" onSave={(v) => update(r.id, "recur_interval_days", v)} /></td>
              <td style={styles.td}><button style={styles.btnSm(COLORS.red)} onClick={() => setConfirmDelete(r.id)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {rules.length === 0 && <div style={{ color: COLORS.muted, textAlign: "center", padding: "40px" }}>No deadline rules found.</div>}
      {confirmDelete && <ConfirmDialog message="Delete this deadline rule?" onConfirm={() => deleteRule(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 3: Document Templates
// ═══════════════════════════════════════════════
function DocumentTemplatesTab({ showToast }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [filterState, setFilterState] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: "", category: "LOR", state: "ALL", linked_task_title: "", file_path: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat) params.set("category", filterCat);
    if (filterState) params.set("state", filterState);
    const res = await fetch(`/api/document-templates?${params}`);
    const data = await res.json();
    setDocs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filterCat, filterState]);

  useEffect(() => { load(); }, [load]);

  const update = async (id, field, value) => {
    const res = await fetch(`/api/document-templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    if (res.ok) { showToast("Updated", "success"); load(); } else { showToast("Update failed", "error"); }
  };

  const addDoc = async () => {
    const res = await fetch("/api/document-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newDoc) });
    if (res.ok) { showToast("Template added", "success"); setAdding(false); setNewDoc({ name: "", category: "LOR", state: "ALL", linked_task_title: "", file_path: "" }); load(); }
    else { showToast("Failed to add", "error"); }
  };

  const deleteDoc = async (id) => {
    const res = await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
    if (res.ok) { showToast("Deleted", "success"); load(); } else { showToast("Delete failed", "error"); }
    setConfirmDelete(null);
  };

  if (loading) return <div style={{ color: COLORS.muted, padding: "40px", textAlign: "center" }}>Loading document templates...</div>;

  return (
    <div>
      <div style={styles.filterBar}>
        <select style={styles.select} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={styles.select} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
          <option value="">All States</option>
          {JURISDICTIONS.filter((j) => j !== "ALL").map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <button style={styles.btn()} onClick={() => setAdding(!adding)}>+ Add Template</button>
      </div>

      {adding && (
        <div style={{ ...styles.card, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Name</label>
            <input style={styles.input} value={newDoc.name} onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Category</label>
            <select style={{ ...styles.select, width: "100%" }} value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>State</label>
            <select style={{ ...styles.select, width: "100%" }} value={newDoc.state} onChange={(e) => setNewDoc({ ...newDoc, state: e.target.value })}>
              <option value="ALL">ALL</option>
              {JURISDICTIONS.filter((j) => j !== "ALL").map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>Linked Task</label>
            <input style={styles.input} value={newDoc.linked_task_title} onChange={(e) => setNewDoc({ ...newDoc, linked_task_title: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: COLORS.muted }}>File Path</label>
            <input style={styles.input} value={newDoc.file_path} onChange={(e) => setNewDoc({ ...newDoc, file_path: e.target.value })} />
          </div>
          <div><button style={styles.btn()} onClick={addDoc}>Save</button></div>
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th}>State</th>
            <th style={styles.th}>Linked Task</th>
            <th style={styles.th}>File Path</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td style={styles.td}><EditableCell value={d.name} onSave={(v) => update(d.id, "name", v)} /></td>
              <td style={styles.td}><EditableCell value={d.category} type="select" options={DOC_CATEGORIES} onSave={(v) => update(d.id, "category", v)} /></td>
              <td style={styles.td}><EditableCell value={d.state} type="select" options={["ALL", ...JURISDICTIONS.filter((j) => j !== "ALL")]} onSave={(v) => update(d.id, "state", v)} /></td>
              <td style={styles.td}><EditableCell value={d.linked_task_title} onSave={(v) => update(d.id, "linked_task_title", v)} /></td>
              <td style={styles.td}><span style={{ fontSize: "12px", color: COLORS.muted, wordBreak: "break-all" }}>{d.file_path || "—"}</span></td>
              <td style={styles.td}><button style={styles.btnSm(COLORS.red)} onClick={() => setConfirmDelete(d.id)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {docs.length === 0 && <div style={{ color: COLORS.muted, textAlign: "center", padding: "40px" }}>No document templates found.</div>}
      {confirmDelete && <ConfirmDialog message="Delete this document template?" onConfirm={() => deleteDoc(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Admin Panel
// ═══════════════════════════════════════════════
export default function WorkflowAdmin() {
  const [activeTab, setActiveTab] = useState("templates");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const tabs = [
    { id: "templates", label: "Workflow Templates" },
    { id: "deadlines", label: "Deadline Rules" },
    { id: "documents", label: "Document Templates" },
  ];

  return (
    <div style={styles.container}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
        <span style={{ color: COLORS.gold }}>⚡</span> Workflow Admin
      </h1>
      <p style={{ color: COLORS.muted, fontSize: "14px", marginBottom: "24px" }}>Manage workflow templates, deadline rules, and document templates</p>

      <div style={styles.tabs}>
        {tabs.map((t) => (
          <button key={t.id} style={styles.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === "templates" && <WorkflowTemplatesTab showToast={showToast} />}
      {activeTab === "deadlines" && <DeadlineRulesTab showToast={showToast} />}
      {activeTab === "documents" && <DocumentTemplatesTab showToast={showToast} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
