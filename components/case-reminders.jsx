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

const REMINDER_TYPES = [
  { value: "follow_up_adjuster", label: "Follow up with Adjuster", icon: "📋" },
  { value: "follow_up_client", label: "Follow up with Client", icon: "👤" },
  { value: "check_repairs", label: "Check on Repairs", icon: "🔧" },
  { value: "send_demand", label: "Send Demand", icon: "📤" },
  { value: "file_document", label: "File Document", icon: "📄" },
  { value: "general", label: "General", icon: "🔔" },
  { value: "stale_case", label: "Stale Case Alert", icon: "⚠️" },
];

export default function CaseReminders({ caseId }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [form, setForm] = useState({ reminder_type: "general", message: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/cases/${caseId}/reminders?completed=${showCompleted}`)
      .then(r => r.json())
      .then(d => setReminders(d.reminders || []))
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, showCompleted]);

  const save = async () => {
    if (!form.message || !form.due_date) return;
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/reminders`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      load(); setShowForm(false); setForm({ reminder_type: "general", message: "", due_date: "" });
    } catch {}
    setSaving(false);
  };

  const autoDetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/reminders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_detect: true }),
      });
      const data = await res.json();
      if (data.stale) {
        load();
        alert(`Stale case detected! No activity in ${data.daysSince} days. Reminder created.`);
      } else {
        alert(`Case is active (last activity ${data.daysSince} days ago). No reminder needed.`);
      }
    } catch {}
    setDetecting(false);
  };

  const toggleComplete = async (r) => {
    await fetch(`/api/cases/${caseId}/reminders`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, completed: !r.completed }),
    });
    load();
  };

  const del = async (id) => {
    await fetch(`/api/cases/${caseId}/reminders?reminderId=${id}`, { method: "DELETE" });
    load();
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const getDaysLeft = (d) => {
    const days = Math.ceil((new Date(d) - Date.now()) / (1000*60*60*24));
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: B.danger };
    if (days === 0) return { text: "Today", color: B.danger };
    if (days <= 3) return { text: `${days}d`, color: B.gold };
    return { text: `${days}d`, color: B.green };
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading reminders...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.gold }}>🔔 Reminders</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={autoDetect} disabled={detecting} style={{ ...S.btnO, fontSize: 11 }}>
            {detecting ? "Checking..." : "🤖 Detect Stale"}
          </button>
          <button onClick={() => setShowForm(true)} style={S.btn}>+ Add Reminder</button>
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: B.txtM, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
        Show completed
      </label>

      {showForm && (
        <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "0 0 200px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Type</label>
              <select value={form.reminder_type} onChange={e => setForm(p => ({ ...p, reminder_type: e.target.value }))} style={S.input}>
                {REMINDER_TYPES.filter(t => t.value !== "stale_case").map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 160px" }}>
              <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={S.input} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Message</label>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              style={{ ...S.input, minHeight: 60, resize: "vertical" }} placeholder="What needs to be done?" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving || !form.message || !form.due_date} style={S.btn}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setShowForm(false)} style={S.btnO}>Cancel</button>
          </div>
        </div>
      )}

      {reminders.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No reminders. Add one or detect stale cases automatically.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {reminders.map(r => {
            const type = REMINDER_TYPES.find(t => t.value === r.reminder_type) || REMINDER_TYPES[5];
            const dl = getDaysLeft(r.due_date);

            return (
              <div key={r.id} style={{
                background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 8,
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                opacity: r.completed ? 0.5 : 1,
              }}>
                <button onClick={() => toggleComplete(r)} style={{
                  width: 22, height: 22, borderRadius: 6, border: `2px solid ${r.completed ? B.green : B.bdr}`,
                  background: r.completed ? B.green : "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, flexShrink: 0,
                }}>
                  {r.completed ? "✓" : ""}
                </button>

                <span style={{ fontSize: 18, flexShrink: 0 }}>{type.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: B.txt, textDecoration: r.completed ? "line-through" : "none" }}>{r.message}</div>
                  <div style={{ fontSize: 11, color: B.txtD, display: "flex", gap: 8, marginTop: 2 }}>
                    <span>{type.label}</span>
                    {r.auto_generated && <span style={{ color: B.gold }}>Auto-generated</span>}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: dl.color }}>{formatDate(r.due_date)}</div>
                  <div style={{ fontSize: 10, color: dl.color }}>{dl.text}</div>
                </div>

                <button onClick={() => del(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: B.txtD, fontSize: 14, padding: 4 }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
