"use client";
import { useState, useEffect } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050",
};

const S = {
  input: {
    background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6,
    padding: "8px 12px", color: B.txt, fontSize: 13, outline: "none", width: "100%",
    fontFamily: "'DM Sans',sans-serif",
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
};

const DEADLINE_TYPES = [
  { value: "discovery_response", label: "Discovery Response" },
  { value: "deposition", label: "Deposition" },
  { value: "motion_deadline", label: "Motion Deadline" },
  { value: "motion_response", label: "Motion Response" },
  { value: "trial_date", label: "Trial Date" },
  { value: "mediation", label: "Mediation" },
  { value: "expert_disclosure", label: "Expert Disclosure" },
  { value: "pretrial_conference", label: "Pretrial Conference" },
  { value: "custom", label: "Custom" },
];

const JURISDICTIONS = ["FL", "KY", "TN", "MT", "NC", "TX", "CA", "WA", "CO", "NY"];

const urgencyStyle = (urgency) => {
  if (!urgency) return {};
  const colors = {
    overdue: { bg: `${B.danger}20`, border: B.danger, text: B.danger },
    critical: { bg: `${B.danger}15`, border: B.danger, text: B.danger },
    warning: { bg: `${B.gold}15`, border: B.gold, text: B.gold },
    ok: { bg: `${B.green}15`, border: B.green, text: B.green },
  };
  return colors[urgency.level] || colors.ok;
};

export default function CourtDeadlines({ caseId }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAutoCalc, setShowAutoCalc] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [form, setForm] = useState({ title: "", deadline_type: "custom", due_date: "", description: "", jurisdiction: "KY" });
  const [autoForm, setAutoForm] = useState({ source_event: "Discovery Served", source_date: "", jurisdiction: "KY" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/cases/${caseId}/deadlines?completed=${showCompleted}`)
      .then(r => r.json())
      .then(d => setDeadlines(d.deadlines || []))
      .catch(() => setDeadlines([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, showCompleted]);

  const saveManual = async () => {
    if (!form.title || !form.due_date) return;
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/deadlines`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      load(); setShowForm(false); setForm({ title: "", deadline_type: "custom", due_date: "", description: "", jurisdiction: "KY" });
    } catch {}
    setSaving(false);
  };

  const autoCalculate = async () => {
    if (!autoForm.source_date) return;
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/deadlines`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...autoForm, auto_calculate: true }),
      });
      load(); setShowAutoCalc(false);
    } catch {}
    setSaving(false);
  };

  const toggleComplete = async (d) => {
    await fetch(`/api/cases/${caseId}/deadlines`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, completed: !d.completed }),
    });
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete this deadline?")) return;
    await fetch(`/api/cases/${caseId}/deadlines?deadlineId=${id}`, { method: "DELETE" });
    load();
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading deadlines...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.gold }}>⏰ Court Deadlines</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAutoCalc(true)} style={{ ...S.btnO, fontSize: 11 }}>🤖 Auto-Calculate</button>
          <button onClick={() => setShowForm(true)} style={S.btn}>+ Add Deadline</button>
        </div>
      </div>

      {/* Toggle completed */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: B.txtM, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
        Show completed deadlines
      </label>

      {/* Auto-Calculate Form */}
      {showAutoCalc && (
        <div style={{ background: B.card, border: `1px solid ${B.gold}40`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 12px", color: B.txt, fontSize: 14 }}>🤖 Auto-Calculate Deadlines</h4>
          <p style={{ fontSize: 12, color: B.txtM, marginBottom: 12 }}>
            Enter a source event and date to auto-generate jurisdiction-specific deadlines.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Source Event</label>
              <input value={autoForm.source_event} onChange={e => setAutoForm(p => ({ ...p, source_event: e.target.value }))} style={S.input} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Event Date</label>
              <input type="date" value={autoForm.source_date} onChange={e => setAutoForm(p => ({ ...p, source_date: e.target.value }))} style={S.input} />
            </div>
            <div style={{ flex: "0 0 120px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Jurisdiction</label>
              <select value={autoForm.jurisdiction} onChange={e => setAutoForm(p => ({ ...p, jurisdiction: e.target.value }))} style={S.input}>
                {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={autoCalculate} disabled={saving} style={S.btn}>{saving ? "Generating..." : "Generate Deadlines"}</button>
            <button onClick={() => setShowAutoCalc(false)} style={S.btnO}>Cancel</button>
          </div>
        </div>
      )}

      {/* Manual Form */}
      {showForm && (
        <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 12px", color: B.txt, fontSize: 14 }}>Add Deadline</h4>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Title</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={S.input} placeholder="e.g. Response to Interrogatories" />
            </div>
            <div style={{ flex: "0 0 180px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Type</label>
              <select value={form.deadline_type} onChange={e => setForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.input}>
                {DEADLINE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 160px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={S.input} />
            </div>
            <div style={{ flex: "0 0 100px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Jurisdiction</label>
              <select value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} style={S.input}>
                {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Description (optional)</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={S.input} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveManual} disabled={saving || !form.title || !form.due_date} style={S.btn}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setShowForm(false)} style={S.btnO}>Cancel</button>
          </div>
        </div>
      )}

      {/* Deadlines List */}
      {deadlines.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No deadlines set. Add one or auto-calculate from a court event.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {deadlines.map(d => {
            const u = d.urgency || { level: "ok", color: B.green, daysLeft: 999 };
            const us = urgencyStyle(u);
            const typeLabel = DEADLINE_TYPES.find(t => t.value === d.deadline_type)?.label || d.deadline_type;

            return (
              <div key={d.id} style={{
                background: us.bg || B.card, border: `1px solid ${us.border || B.bdr}`,
                borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                opacity: d.completed ? 0.5 : 1,
              }}>
                <button onClick={() => toggleComplete(d)} style={{
                  width: 22, height: 22, borderRadius: 6, border: `2px solid ${d.completed ? B.green : B.bdr}`,
                  background: d.completed ? B.green : "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, flexShrink: 0,
                }}>
                  {d.completed ? "✓" : ""}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: B.txt, textDecoration: d.completed ? "line-through" : "none" }}>{d.title}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${B.bdr}`, color: B.txtM }}>{typeLabel}</span>
                    {d.auto_calculated && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${B.gold}20`, color: B.gold }}>Auto</span>}
                    {d.jurisdiction && <span style={{ fontSize: 9, color: B.txtD }}>{d.jurisdiction}</span>}
                  </div>
                  {d.description && <div style={{ fontSize: 11, color: B.txtM }}>{d.description}</div>}
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: us.text || B.txtM }}>{formatDate(d.due_date)}</div>
                  <div style={{ fontSize: 11, color: us.text || B.txtD }}>
                    {u.daysLeft < 0 ? `${Math.abs(u.daysLeft)}d overdue` : u.daysLeft === 0 ? "TODAY" : `${u.daysLeft}d left`}
                  </div>
                </div>

                <button onClick={() => del(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: B.txtD, fontSize: 14, padding: 4 }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
