"use client";
import { useState, useEffect, useRef } from "react";

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
  mono: { fontFamily: "'JetBrains Mono',monospace" },
};

const STATUS_CLR = { draft: B.txtD, sent: B.gold, responded: "#5b8def", accepted: B.green, rejected: B.danger };
const fmt$ = v => v == null ? "—" : "$" + Number(v).toLocaleString();
const fmtD = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function DemandGenerator({ caseId }) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const previewRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/demand`);
      const d = await r.json();
      if (Array.isArray(d)) setDemands(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [caseId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true }),
      });
      const d = await r.json();
      if (d.error) alert(d.error);
      else { setDemands(prev => [d, ...prev]); setSelected(d); }
    } catch (err) { alert(err.message); }
    setGenerating(false);
  };

  const saveDraft = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/demand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demand_id: selected.id, html_content: editContent, content: editContent.replace(/<[^>]+>/g, " ").trim() }),
      });
      const d = await r.json();
      if (!d.error) {
        setSelected(d);
        setDemands(prev => prev.map(x => x.id === d.id ? d : x));
        setEditing(false);
      }
    } catch {}
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    try {
      const r = await fetch(`/api/cases/${caseId}/demand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demand_id: id, status }),
      });
      const d = await r.json();
      if (!d.error) {
        setDemands(prev => prev.map(x => x.id === d.id ? d : x));
        if (selected?.id === d.id) setSelected(d);
      }
    } catch {}
  };

  const deleteDemand = async (id) => {
    if (!confirm("Delete this demand letter?")) return;
    try {
      await fetch(`/api/cases/${caseId}/demand?demand_id=${id}`, { method: "DELETE" });
      setDemands(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {}
  };

  const printDemand = () => {
    if (!selected) return;
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Demand Letter</title></head><body>${selected.html_content}</body></html>`);
    w.document.close();
    w.print();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading demands...</div>;

  if (selected) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={() => { setSelected(null); setEditing(false); }} style={S.btnO}>← Back to List</button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)} style={{ ...S.btnO, appearance: "auto", padding: "6px 12px" }}>
              {["draft", "sent", "responded", "accepted", "rejected"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            {!editing && <button onClick={() => { setEditContent(selected.html_content || ""); setEditing(true); }} style={S.btnO}>✏️ Edit</button>}
            {editing && <button onClick={saveDraft} disabled={saving} style={S.btn}>{saving ? "Saving..." : "💾 Save"}</button>}
            {editing && <button onClick={() => setEditing(false)} style={S.btnO}>Cancel</button>}
            <button onClick={printDemand} style={S.btnO}>🖨️ Print</button>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.txt }}>{selected.title}</h3>
              <div style={{ fontSize: 12, color: B.txtD, marginTop: 4 }}>{fmtD(selected.created_at)} · {fmt$(selected.demand_amount)}</div>
            </div>
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${STATUS_CLR[selected.status] || B.txtD}20`, color: STATUS_CLR[selected.status] || B.txtD }}>
              {selected.status}
            </span>
          </div>
          {editing ? (
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
              style={{ width: "100%", minHeight: 500, background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 8, padding: 16, color: B.txt, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", resize: "vertical" }} />
          ) : (
            <div ref={previewRef} style={{ background: "#fff", color: "#222", borderRadius: 8, padding: 20, minHeight: 400 }}
              dangerouslySetInnerHTML={{ __html: selected.html_content || "<p>No content</p>" }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.txt }}>📄 Demand Letters</h3>
        <button onClick={generate} disabled={generating} style={{ ...S.btn, opacity: generating ? 0.5 : 1 }}>
          {generating ? "⏳ Generating..." : "✨ Generate Demand Letter"}
        </button>
      </div>

      {demands.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: B.txt, marginBottom: 8 }}>No Demand Letters Yet</div>
          <div style={{ fontSize: 13, color: B.txtM, marginBottom: 20 }}>Click "Generate Demand Letter" to create an AI-drafted demand based on case data.</div>
          <button onClick={generate} disabled={generating} style={S.btn}>{generating ? "Generating..." : "✨ Generate Now"}</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {demands.map(d => (
            <div key={d.id} style={{ ...S.card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onClick={() => setSelected(d)}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.txt }}>{d.title}</div>
                <div style={{ fontSize: 12, color: B.txtD, marginTop: 2 }}>{fmtD(d.created_at)} · {fmt$(d.demand_amount)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${STATUS_CLR[d.status] || B.txtD}20`, color: STATUS_CLR[d.status] || B.txtD }}>
                  {d.status}
                </span>
                <button onClick={e => { e.stopPropagation(); deleteDemand(d.id); }} style={{ ...S.btnO, padding: "4px 8px", fontSize: 11, color: B.danger }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
