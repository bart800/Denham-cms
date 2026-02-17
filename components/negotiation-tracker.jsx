"use client";
import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const BG = "#111118";
const CARD_BG = "#1a1a2e";
const TEXT = "#e0e0e0";
const MUTED = "#888";

function fmt$(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NegotiationTracker({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({ type: "demand", amount: "", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/negotiations`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [caseId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/negotiations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) {
      setForm({ type: "demand", amount: "", date: new Date().toISOString().slice(0, 10), notes: "" });
      setShowForm(false);
      await fetchItems();
    }
    setSaving(false);
  };

  const latestDemand = items.find((i) => i.type === "demand");
  const latestOffer = items.find((i) => i.type === "offer");
  const gap = latestDemand && latestOffer ? latestDemand.amount - latestOffer.amount : null;
  const rounds = Math.max(items.filter((i) => i.type === "demand").length, items.filter((i) => i.type === "offer").length);

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  if (loading) return <div style={{ color: MUTED, padding: 20 }}>Loading negotiations…</div>;

  return (
    <div style={{ background: BG, borderRadius: 12, padding: 24, fontFamily: "system-ui, sans-serif" }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Latest Demand", value: latestDemand ? fmt$(latestDemand.amount) : "—", color: GOLD },
          { label: "Latest Offer", value: latestOffer ? fmt$(latestOffer.amount) : "—", color: NAVY },
          { label: "Gap", value: gap !== null ? fmt$(gap) : "—", color: gap > 0 ? "#e74c3c" : GREEN },
          { label: "Rounds", value: rounds, color: TEXT },
        ].map((s) => (
          <div key={s.label} style={{ background: CARD_BG, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add button */}
      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          {showForm ? "Cancel" : "+ Add Entry"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: CARD_BG, borderRadius: 8, padding: 20, marginBottom: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ color: MUTED, fontSize: 12, display: "block", marginBottom: 4 }}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: `1px solid ${MUTED}`, background: BG, color: TEXT, fontSize: 14 }}
            >
              <option value="demand">Demand</option>
              <option value="offer">Offer</option>
              <option value="counter">Counter</option>
            </select>
          </div>
          <div>
            <label style={{ color: MUTED, fontSize: 12, display: "block", marginBottom: 4 }}>Amount ($)</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: `1px solid ${MUTED}`, background: BG, color: TEXT, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ color: MUTED, fontSize: 12, display: "block", marginBottom: 4 }}>Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: `1px solid ${MUTED}`, background: BG, color: TEXT, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ color: MUTED, fontSize: 12, display: "block", marginBottom: 4 }}>Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: `1px solid ${MUTED}`, background: BG, color: TEXT, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
            <button
              type="submit"
              disabled={saving}
              style={{ background: GOLD, color: "#000", border: "none", borderRadius: 6, padding: "8px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {items.length === 0 ? (
        <div style={{ color: MUTED, textAlign: "center", padding: 40 }}>No negotiations recorded yet.</div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 0 }}>
          {/* Center line */}
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "#333", transform: "translateX(-1px)" }} />
          {items.map((item) => {
            const isDemand = item.type === "demand";
            const isOffer = item.type === "offer";
            const color = isDemand ? GOLD : isOffer ? NAVY : GREEN;
            const alignRight = isOffer;

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: alignRight ? "flex-end" : "flex-start",
                  marginBottom: 16,
                  position: "relative",
                }}
              >
                {/* Dot on center line */}
                <div style={{ position: "absolute", left: "50%", top: 16, width: 12, height: 12, borderRadius: "50%", background: color, transform: "translate(-50%, 0)", zIndex: 1, border: `2px solid ${BG}` }} />

                <div
                  style={{
                    width: "44%",
                    background: CARD_BG,
                    borderRadius: 8,
                    padding: "14px 18px",
                    borderLeft: alignRight ? "none" : `3px solid ${color}`,
                    borderRight: alignRight ? `3px solid ${color}` : "none",
                    cursor: item.notes ? "pointer" : "default",
                  }}
                  onClick={() => item.notes && toggle(item.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{item.type}</span>
                    <span style={{ color: MUTED, fontSize: 12 }}>{fmtDate(item.date)}</span>
                  </div>
                  <div style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>{fmt$(item.amount)}</div>
                  {item.notes && (
                    <div style={{ marginTop: 8, color: MUTED, fontSize: 13, overflow: "hidden", maxHeight: expanded[item.id] ? 500 : 0, transition: "max-height 0.3s ease" }}>
                      {item.notes}
                    </div>
                  )}
                  {item.notes && !expanded[item.id] && (
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>▸ click to expand notes</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
