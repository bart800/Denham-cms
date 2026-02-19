"use client";
import { useState, useEffect } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050",
};
const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20 },
  btn: { background: B.gold, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnO: { background: "transparent", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: B.txtM, fontFamily: "'DM Sans',sans-serif" },
  input: { background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6, padding: "8px 12px", color: B.txt, fontSize: 13, outline: "none", width: "100%", fontFamily: "'DM Sans',sans-serif" },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
};

const CATEGORIES = ["filing", "expert", "mediation", "deposition", "travel", "postage", "other"];
const CAT_ICON = { filing: "📋", expert: "🧪", mediation: "🤝", deposition: "📝", travel: "✈️", postage: "📬", other: "📦" };
const CAT_CLR = { filing: "#5b8def", expert: "#9b59b6", mediation: B.gold, deposition: B.navy, travel: B.green, postage: "#e67e22", other: B.txtM };
const fmt$ = v => v == null ? "—" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function ExpenseTracker({ caseId }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ description: "", amount: "", category: "other", date_incurred: "", paid_by: "firm", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/expenses`);
      const d = await r.json();
      if (Array.isArray(d)) setExpenses(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [caseId]);

  const resetForm = () => { setForm({ description: "", amount: "", category: "other", date_incurred: "", paid_by: "firm", notes: "" }); setEditId(null); setShowForm(false); };

  const save = async () => {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0 };
      if (editId) {
        const r = await fetch(`/api/cases/${caseId}/expenses`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expense_id: editId, ...payload }) });
        const d = await r.json();
        if (!d.error) setExpenses(prev => prev.map(x => x.id === d.id ? d : x));
      } else {
        const r = await fetch(`/api/cases/${caseId}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (!d.error) setExpenses(prev => [d, ...prev]);
      }
      resetForm();
    } catch {}
    setSaving(false);
  };

  const startEdit = (e) => {
    setForm({ description: e.description, amount: e.amount || "", category: e.category, date_incurred: e.date_incurred || "", paid_by: e.paid_by, notes: e.notes || "" });
    setEditId(e.id);
    setShowForm(true);
  };

  const del = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await fetch(`/api/cases/${caseId}/expenses?expense_id=${id}`, { method: "DELETE" });
      setExpenses(prev => prev.filter(x => x.id !== id));
    } catch {}
  };

  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const firmTotal = expenses.filter(e => e.paid_by === "firm").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const clientTotal = expenses.filter(e => e.paid_by === "client").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Category breakdown
  const catBreakdown = {};
  expenses.forEach(e => {
    catBreakdown[e.category] = (catBreakdown[e.category] || 0) + (parseFloat(e.amount) || 0);
  });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading expenses...</div>;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Total Expenses", v: fmt$(total), c: B.txt },
          { l: "Firm Paid", v: fmt$(firmTotal), c: B.gold },
          { l: "Client Paid", v: fmt$(clientTotal), c: B.green },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 20, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Category Breakdown Bar */}
      {Object.keys(catBreakdown).length > 0 && total > 0 && (
        <div style={{ ...S.card, marginBottom: 20, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: B.txtD, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>By Category</div>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 24, marginBottom: 12 }}>
            {Object.entries(catBreakdown).map(([cat, amt]) => (
              <div key={cat} style={{ width: `${(amt / total) * 100}%`, background: CAT_CLR[cat] || B.txtD, minWidth: 2 }} title={`${cat}: ${fmt$(amt)}`} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: CAT_CLR[cat] || B.txtD, display: "inline-block" }} />
                <span style={{ color: B.txtM }}>{CAT_ICON[cat]} {cat}</span>
                <span style={{ ...S.mono, color: B.txt }}>{fmt$(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.txt }}>💵 Expenses</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={S.btn}>+ Add Expense</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 16, borderColor: `${B.gold}40` }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: B.gold }}>{editId ? "Edit Expense" : "New Expense"}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Description *</div>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={S.input} placeholder="e.g. Filing fee - Circuit Court" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Amount *</div>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={S.input} placeholder="0.00" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Category</div>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.input}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Date Incurred</div>
              <input type="date" value={form.date_incurred} onChange={e => setForm({ ...form, date_incurred: e.target.value })} style={S.input} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Paid By</div>
              <select value={form.paid_by} onChange={e => setForm({ ...form, paid_by: e.target.value })} style={S.input}>
                <option value="firm">Firm</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...S.input, minHeight: 50, resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button onClick={resetForm} style={S.btnO}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : editId ? "Update" : "Add"}</button>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💵</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: B.txt, marginBottom: 8 }}>No Expenses Recorded</div>
          <div style={{ fontSize: 13, color: B.txtM }}>Track filing fees, expert costs, mediation fees, and more.</div>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["", "Description", "Category", "Date", "Amount", "Paid By", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "10px 12px", borderBottom: `1px solid ${B.bdr}`, color: B.txtD, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${B.bdr}06` }}>
                <td style={{ padding: "10px 12px" }}>{CAT_ICON[e.category] || "📦"}</td>
                <td style={{ padding: "10px 12px", color: B.txt, fontWeight: 500 }}>{e.description}{e.notes && <span style={{ fontSize: 11, color: B.txtD, marginLeft: 8 }}>({e.notes})</span>}</td>
                <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: `${CAT_CLR[e.category] || B.txtD}15`, color: CAT_CLR[e.category] || B.txtD }}>{e.category}</span></td>
                <td style={{ padding: "10px 12px", color: B.txtM, ...S.mono, fontSize: 12 }}>{fmtD(e.date_incurred)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", ...S.mono, fontWeight: 600, color: B.txt }}>{fmt$(e.amount)}</td>
                <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: e.paid_by === "firm" ? `${B.gold}15` : `${B.green}15`, color: e.paid_by === "firm" ? B.gold : B.green }}>{e.paid_by}</span></td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(e)} style={{ ...S.btnO, padding: "2px 6px", fontSize: 10 }}>✏️</button>
                    <button onClick={() => del(e.id)} style={{ ...S.btnO, padding: "2px 6px", fontSize: 10, color: B.danger }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: "12px", textAlign: "right", color: B.txtM }}>TOTAL</td>
              <td style={{ padding: "12px", textAlign: "right", ...S.mono, fontSize: 15, color: B.gold, borderTop: `2px solid ${B.gold}40` }}>{fmt$(total)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
