"use client";
import { useState, useEffect } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
};

const TYPE_CONFIG = {
  email: { icon: "📧", color: "#4a90d9", label: "Email" },
  call: { icon: "📞", color: "#386f4a", label: "Call" },
  note: { icon: "📝", color: "#ebb003", label: "Note" },
  message: { icon: "💬", color: "#7c5cbf", label: "Portal Message" },
};

const FILTERS = ["all", "email", "call", "note", "message"];

export default function CommunicationTimeline({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/cases/${caseId}/communications${filter !== "all" ? `?type=${filter}` : ""}`)
      .then(r => r.json())
      .then(d => setItems(d.communications || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [caseId, filter]);

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const filtered = searchTerm
    ? items.filter(i => (i.title + i.subtitle + i.content).toLowerCase().includes(searchTerm.toLowerCase()))
    : items;

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const formatContent = (text) => {
    if (!text) return "";
    if (text.length > 300) return text.substring(0, 300) + "...";
    return text;
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading communications...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.gold }}>📋 Communication Timeline</h3>
        <span style={{ fontSize: 12, color: B.txtM }}>{filtered.length} items</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {FILTERS.map(f => {
          const cfg = f === "all" ? { icon: "🔄", label: "All" } : TYPE_CONFIG[f];
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === f ? B.gold : B.bdr}`,
              background: filter === f ? `${B.gold}20` : "transparent",
              color: filter === f ? B.gold : B.txtM, fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
        <input
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            background: "#0a0a14", border: `1px solid ${B.bdr}`, borderRadius: 6,
            padding: "6px 12px", color: B.txt, fontSize: 12, outline: "none", marginLeft: "auto", width: 200,
            fontFamily: "'DM Sans',sans-serif",
          }}
        />
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: B.txtD }}>No communications found</div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 24 }}>
          {/* Vertical line */}
          <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: B.bdr }} />

          {filtered.map((item, idx) => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.note;
            const isExpanded = expanded[item.id];

            return (
              <div key={item.id} style={{ marginBottom: 12, position: "relative" }}>
                {/* Dot on timeline */}
                <div style={{
                  position: "absolute", left: -18, top: 14, width: 18, height: 18, borderRadius: "50%",
                  background: B.card, border: `2px solid ${cfg.color}`, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 9, zIndex: 1,
                }}>
                  {cfg.icon}
                </div>

                {/* Card */}
                <div
                  onClick={() => item.content && toggleExpand(item.id)}
                  style={{
                    background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 8,
                    padding: "12px 16px", cursor: item.content ? "pointer" : "default",
                    borderLeft: `3px solid ${cfg.color}`,
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: B.txt }}>{item.title}</span>
                        <span style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 10,
                          background: `${cfg.color}20`, color: cfg.color, fontWeight: 600,
                        }}>
                          {cfg.label}
                        </span>
                        {item.direction && (
                          <span style={{ fontSize: 10, color: B.txtD }}>
                            {item.direction === "inbound" ? "⬇ In" : "⬆ Out"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: B.txtM }}>{item.subtitle}</div>
                    </div>
                    <div style={{ fontSize: 11, color: B.txtD, whiteSpace: "nowrap" }}>{formatDate(item.date)}</div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && item.content && (
                    <div style={{
                      marginTop: 12, padding: 12, background: "#0a0a14", borderRadius: 6,
                      fontSize: 12, color: B.txtM, lineHeight: 1.6, whiteSpace: "pre-wrap",
                      maxHeight: 400, overflowY: "auto",
                    }}>
                      {item.content}
                    </div>
                  )}

                  {/* Preview when collapsed */}
                  {!isExpanded && item.content && (
                    <div style={{ marginTop: 6, fontSize: 11, color: B.txtD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {formatContent(item.content)}
                    </div>
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
