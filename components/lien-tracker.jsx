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

const TYPES = ["mortgage", "contractor", "hoa", "government", "other"];
const STATUSES = ["pending", "negotiated", "satisfied", "waived"];
const TYPE_ICON = { mortgage: "🏦", contractor: "🔨", hoa: "🏘️", government: "🏛️", other: "📋" };
const STATUS_CLR = { pending: B.gold, negotiated: "#5b8def", satisfied: B.green, waived: B.txtD };
const fmt$ = v => v == null ? "—" : "$" + Number(v).toLocaleString();
const fmtD = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function LienTracker({ caseId }) {
  const [liens, setLiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ holder_name: "", holder_type: "other", amount: "", negotiated_amount: "", status: "pending", contact_info: "", payoff_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/liens`);
      const d = await r.json();
      if (Array.isArray(d)) setLiens(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [caseId]);

  const resetForm = () => { setForm({ holder_name: "", holder_type: "other", amount: "", negotiated_amount: "", status: "pending", contact_info: "", payoff_date: "", notes: "" }); setEditId(null); setShowForm(false); };

  const save = async () => {
    if (!form.holder_name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0, negotiated_amount: form.negotiated_amount ? parseFloat(form.negotiated_amount) : null };
      if (editId) {
        const r = await fetch(`/api/cases/${caseId}/liens`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lien_id: editId, ...payload }) });
        const d = await r.json();
        if (!d.error) setLiens(prev => prev.map(x => x.id === d.id ? d : x));
      } else {
        const r = await fetch(`/api/cases/${caseId}/liens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (!d.error) setLiens(prev => [d, ...prev]);
      }
      resetForm();
    } catch {}
    setSaving(false);
  };

  const startEdit = (l) => {
    setForm({ holder_name: l.holder_name, holder_type: l.holder_type, amount: l.amount || "", negotiated_amount: l.negotiated_amount || "", status: l.status, contact_info: l.contact_info || "", payoff_date: l.payoff_date || "", notes: l.notes || "" });
    setEditId(l.id);
    setShowForm(true);
  };

  const del = async (id) => {
    if (!confirm("Delete this lien?")) return;
    try {
      await fetch(`/api/cases/${caseId}/liens?lien_id=${id}`, { method: "DELETE" });
      setLiens(prev => prev.filter(x => x.id !== id));
    } catch {}
  };

  const totalExposure = liens.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalNegotiated = liens.filter(l => l.negotiated_amount != null).reduce((s, l) => s + (parseFloat(l.negotiated_amount) || 0), 0);
  const totalSaved = totalExposure - totalNegotiated;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading liens...</div>;

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Total Liens", v: liens.length, c: B.txt },
          { l: "Total Exposure", v: fmt$(totalExposure), c: B.danger },
          { l: "Negotiated", v: fmt$(totalNegotiated), c: B.gold },
          { l: "Potential Savings", v: fmt$(totalSaved > 0 ? totalSaved : 0), c: B.green },
        ].map((x, i) => (
          <div key={i} style={{ ...S.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
            <div style={{ ...S.mono, fontSize: 18, fontWeight: 700, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.txt }}>🔗 Liens</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={S.btn}>+ Add Lien</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 16, borderColor: `${B.gold}40` }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: B.gold }}>{editId ? "Edit Lien" : "New Lien"}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Holder Name *</div>
              <input value={form.holder_name} onChange={e => setForm({ ...form, holder_name: e.target.value })} style={S.input} placeholder="e.g. Wells Fargo" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Type</div>
              <select value={form.holder_type} onChange={e => setForm({ ...form, holder_type: e.target.value })} style={S.input}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Amount</div>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={S.input} placeholder="0.00" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Negotiated Amount</div>
              <input type="number" value={form.negotiated_amount} onChange={e => setForm({ ...form, negotiated_amount: e.target.value })} style={S.input} placeholder="0.00" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Status</div>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={S.input}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Payoff Date</div>
              <input type="date" value={form.payoff_date} onChange={e => setForm({ ...form, payoff_date: e.target.value })} style={S.input} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Contact Info</div>
              <input value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} style={S.input} placeholder="Phone, email, address..." />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 10, color: B.txtD, textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...S.input, minHeight: 60, resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button onClick={resetForm} style={S.btnO}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : editId ? "Update" : "Add Lien"}</button>
          </div>
        </div>
      )}

      {liens.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: B.txt, marginBottom: 8 }}>No Liens Tracked</div>
          <div style={{ fontSize: 13, color: B.txtM }}>Add liens to track mortgage, contractor, HOA, and government liens on this case.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {liens.map(l => (
            <div key={l.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                <span style={{ fontSize: 24 }}>{TYPE_ICON[l.holder_type] || "📋"}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: B.txt }}>{l.holder_name}</div>
                  <div style={{ fontSize: 12, color: B.txtD, marginTop: 2 }}>
                    {l.holder_type} · {l.contact_info || "No contact"} {l.payoff_date ? `· Due ${fmtD(l.payoff_date)}` : ""}
                  </div>
                  {l.notes && <div style={{ fontSize: 11, color: B.txtD, marginTop: 2, fontStyle: "italic" }}>{l.notes}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...S.mono, fontSize: 15, fontWeight: 700, color: B.danger }}>{fmt$(l.amount)}</div>
                  {l.negotiated_amount != null && <div style={{ ...S.mono, fontSize: 12, color: B.green }}>→ {fmt$(l.negotiated_amount)}</div>}
                </div>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${STATUS_CLR[l.status] || B.txtD}20`, color: STATUS_CLR[l.status] || B.txtD }}>
                  {l.status}
                </span>
                <button onClick={() => startEdit(l)} style={{ ...S.btnO, padding: "4px 8px", fontSize: 11 }}>✏️</button>
                <button onClick={() => del(l.id)} style={{ ...S.btnO, padding: "4px 8px", fontSize: 11, color: B.danger }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
