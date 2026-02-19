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

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

const EMPTY = {
  name: "New Scenario", property_damage: 0, depreciation: 0, deductible: 0,
  policy_limits: 0, additional_living_expenses: 0, code_upgrades: 0,
  insurer_offer: 0, our_demand: 0, notes: "",
};

function calc(s) {
  const pd = Number(s.property_damage) || 0;
  const dep = Number(s.depreciation) || 0;
  const ded = Number(s.deductible) || 0;
  const ale = Number(s.additional_living_expenses) || 0;
  const cu = Number(s.code_upgrades) || 0;
  const offer = Number(s.insurer_offer) || 0;
  const demand = Number(s.our_demand) || 0;
  const policy = Number(s.policy_limits) || 0;
  const rcv = pd + cu;
  const acv = rcv - dep;
  const holdback = dep;
  const netClaim = acv - ded + ale;
  const gap = demand - offer;
  const gapPct = demand > 0 ? ((gap / demand) * 100).toFixed(1) : 0;
  const policyExcess = netClaim > policy && policy > 0 ? netClaim - policy : 0;
  return { rcv, acv, holdback, netClaim, gap, gapPct, policyExcess };
}

export default function SettlementCalculator({ caseId }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/cases/${caseId}/settlement`)
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios || []))
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId]);

  const save = async () => {
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing } : form;
      const res = await fetch(`/api/cases/${caseId}/settlement`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) { load(); setForm({ ...EMPTY }); setEditing(null); setShowForm(false); }
    } catch {}
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm("Delete this scenario?")) return;
    await fetch(`/api/cases/${caseId}/settlement?scenarioId=${id}`, { method: "DELETE" });
    load();
  };

  const edit = (s) => {
    setForm({
      name: s.name, property_damage: s.property_damage, depreciation: s.depreciation,
      deductible: s.deductible, policy_limits: s.policy_limits,
      additional_living_expenses: s.additional_living_expenses, code_upgrades: s.code_upgrades,
      insurer_offer: s.insurer_offer, our_demand: s.our_demand, notes: s.notes || "",
    });
    setEditing(s.id);
    setShowForm(true);
  };

  const v = calc(form);

  const Field = ({ label, field }) => (
    <div style={{ flex: "1 1 180px" }}>
      <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>{label}</label>
      <input type="number" value={form[field] || ""} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        style={S.input} placeholder="0" />
    </div>
  );

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading settlement data...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.gold }}>💰 Settlement Calculator</h3>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ ...EMPTY }); }} style={S.btn}>+ New Scenario</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: B.txt }}>{editing ? "Edit Scenario" : "New Scenario"}</h4>
            <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ ...S.btnO, fontSize: 11, padding: "4px 12px" }}>✕</button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Scenario Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ ...S.input, maxWidth: 300 }} />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Field label="Property Damage ($)" field="property_damage" />
            <Field label="Depreciation ($)" field="depreciation" />
            <Field label="Deductible ($)" field="deductible" />
            <Field label="Policy Limits ($)" field="policy_limits" />
            <Field label="Additional Living Expenses ($)" field="additional_living_expenses" />
            <Field label="Code Upgrades ($)" field="code_upgrades" />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Field label="Insurer's Offer ($)" field="insurer_offer" />
            <Field label="Our Demand ($)" field="our_demand" />
          </div>

          {/* Live Calculations */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16, padding: 16, background: "#0a0a14", borderRadius: 8 }}>
            <div><div style={{ fontSize: 10, color: B.txtD }}>RCV</div><div style={{ fontSize: 16, fontWeight: 700, color: B.green }}>{fmt(v.rcv)}</div></div>
            <div><div style={{ fontSize: 10, color: B.txtD }}>ACV</div><div style={{ fontSize: 16, fontWeight: 700, color: B.gold }}>{fmt(v.acv)}</div></div>
            <div><div style={{ fontSize: 10, color: B.txtD }}>Holdback</div><div style={{ fontSize: 16, fontWeight: 700, color: B.txtM }}>{fmt(v.holdback)}</div></div>
            <div><div style={{ fontSize: 10, color: B.txtD }}>Net Claim</div><div style={{ fontSize: 16, fontWeight: 700, color: B.navy === "#000066" ? "#6666ff" : B.navy }}>{fmt(v.netClaim)}</div></div>
            <div><div style={{ fontSize: 10, color: B.txtD }}>Gap (Demand - Offer)</div><div style={{ fontSize: 16, fontWeight: 700, color: v.gap > 0 ? B.danger : B.green }}>{fmt(v.gap)} ({v.gapPct}%)</div></div>
            {v.policyExcess > 0 && <div><div style={{ fontSize: 10, color: B.danger }}>⚠ Exceeds Policy By</div><div style={{ fontSize: 16, fontWeight: 700, color: B.danger }}>{fmt(v.policyExcess)}</div></div>}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: B.txtD, display: "block", marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              style={{ ...S.input, minHeight: 60, resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={S.btn}>{saving ? "Saving..." : editing ? "Update" : "Save Scenario"}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} style={S.btnO}>Cancel</button>
          </div>
        </div>
      )}

      {/* Saved Scenarios */}
      {scenarios.length === 0 && !showForm ? (
        <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No scenarios yet. Create one to start calculating.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {scenarios.map(s => {
            const sv = calc(s);
            return (
              <div key={s.id} style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 15, color: B.txt }}>{s.name}</h4>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => edit(s)} style={{ ...S.btnO, fontSize: 11, padding: "4px 10px" }}>Edit</button>
                    <button onClick={() => del(s.id)} style={{ ...S.btnO, fontSize: 11, padding: "4px 10px", color: B.danger, borderColor: `${B.danger}40` }}>Delete</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <Metric label="Property Damage" value={fmt(s.property_damage)} />
                  <Metric label="RCV" value={fmt(sv.rcv)} color={B.green} />
                  <Metric label="ACV" value={fmt(sv.acv)} color={B.gold} />
                  <Metric label="Holdback" value={fmt(sv.holdback)} />
                  <Metric label="Deductible" value={fmt(s.deductible)} />
                  <Metric label="ALE" value={fmt(s.additional_living_expenses)} />
                  <Metric label="Net Claim" value={fmt(sv.netClaim)} color="#6666ff" bold />
                  <Metric label="Insurer Offer" value={fmt(s.insurer_offer)} color={B.danger} />
                  <Metric label="Our Demand" value={fmt(s.our_demand)} color={B.green} />
                  <Metric label="Gap" value={`${fmt(sv.gap)} (${sv.gapPct}%)`} color={sv.gap > 0 ? B.danger : B.green} bold />
                </div>

                {/* Gap Analysis Bar */}
                {(Number(s.our_demand) > 0 || Number(s.insurer_offer) > 0) && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: B.txtD, marginBottom: 6 }}>Gap Analysis</div>
                    <div style={{ position: "relative", height: 24, background: "#0a0a14", borderRadius: 6, overflow: "hidden" }}>
                      {Number(s.our_demand) > 0 && (
                        <div style={{
                          position: "absolute", left: 0, top: 0, height: "100%",
                          width: `${Math.min(100, (Number(s.insurer_offer) / Number(s.our_demand)) * 100)}%`,
                          background: `linear-gradient(90deg, ${B.danger}, ${B.gold})`, borderRadius: 6,
                          display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10, color: "#000", fontWeight: 600,
                        }}>
                          Offer: {fmt(s.insurer_offer)}
                        </div>
                      )}
                      <div style={{ position: "absolute", right: 8, top: 4, fontSize: 10, color: B.txtM }}>
                        Demand: {fmt(s.our_demand)}
                      </div>
                    </div>
                  </div>
                )}

                {s.notes && <div style={{ marginTop: 10, fontSize: 12, color: B.txtM, fontStyle: "italic" }}>{s.notes}</div>}
                <div style={{ marginTop: 8, fontSize: 10, color: B.txtD }}>Created {new Date(s.created_at).toLocaleDateString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color, bold }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#55556a" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: color || "#e8e8f0", fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
    </div>
  );
}
