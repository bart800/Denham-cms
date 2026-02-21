"use client";
import { useState, useEffect, useCallback } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const DARK_BG = "#0a0a2e";
const CARD_BG = "#000044";
const TEXT = "#e0e0e0";
const BORDER = "#1a1a5e";

const ALL_CATEGORIES = [
  "Photos","Discovery","Correspondence","E-Pleadings","Pleadings",
  "PA Files","Estimates","Presuit","Client Docs","Policy",
  "Scoping","Receipts","Exhibits","Uncategorized"
];

const FILE_ICONS = {
  pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
  jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️",
  mp4: "🎥", mov: "🎥", txt: "📃", csv: "📊", default: "📎",
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function CaseDocumentsTab({ caseId }) {
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzeAllResult, setAnalyzeAllResult] = useState(null);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === docs.length) setSelected(new Set());
    else setSelected(new Set(docs.map(d => d.id)));
  };
  const handleBulkCategorize = async () => {
    if (!bulkCategory || selected.size === 0) return;
    setBulkUpdating(true);
    try {
      await fetch("/api/docs/bulk-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], category: bulkCategory }),
      });
      setSelected(new Set());
      setBulkCategory("");
      fetchDocs();
    } catch (e) { console.error(e); }
    setBulkUpdating(false);
  };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 50 });
    if (activeCategory) params.set("category", activeCategory);
    try {
      const res = await fetch(`/api/cases/${caseId}/documents?${params}`);
      const data = await res.json();
      setDocs(data.documents || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [caseId, page, activeCategory]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { setPage(1); }, [activeCategory]);

  const handleAnalyze = async (doc) => {
    setAnalyzing(doc.id);
    try {
      await fetch("/api/docs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: doc.id }),
      });
      fetchDocs();
    } catch (e) { console.error(e); }
    setAnalyzing(null);
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    setAnalyzeAllResult(null);
    try {
      const res = await fetch("/api/docs/analyze-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const data = await res.json();
      setAnalyzeAllResult(data);
      fetchDocs();
    } catch (e) { console.error(e); }
    setAnalyzingAll(false);
  };

  // Group docs by category
  const grouped = {};
  docs.forEach((d) => {
    const cat = d.category || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(d);
  });

  return (
    <div style={{ color: TEXT }}>
      {/* Category filter buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13, color: TEXT }}>
          <input type="checkbox" checked={docs.length > 0 && selected.size === docs.length} onChange={toggleAll}
            style={{ cursor: "pointer", accentColor: GOLD }} />
          All
        </label>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid " + BORDER, cursor: "pointer",
            background: !activeCategory ? GOLD : CARD_BG, color: !activeCategory ? "#000" : TEXT,
            fontWeight: !activeCategory ? 700 : 400, fontSize: 13,
          }}
        >All ({total})</button>
        <button onClick={handleAnalyzeAll} disabled={analyzingAll} style={{
          padding: "6px 14px", borderRadius: 6, border: "1px solid " + GREEN, cursor: "pointer",
          background: analyzingAll ? "#444" : GREEN, color: "#fff",
          fontWeight: 600, fontSize: 13, marginLeft: "auto",
        }}>{analyzingAll ? "⏳ Analyzing..." : "🤖 Analyze All"}</button>
        {ALL_CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid " + BORDER, cursor: "pointer",
            background: activeCategory === cat ? GOLD : CARD_BG, color: activeCategory === cat ? "#000" : TEXT,
            fontWeight: activeCategory === cat ? 700 : 400, fontSize: 13,
          }}>{cat}</button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: DARK_BG, borderRadius: 8, marginBottom: 12, border: "1px solid " + GOLD,
        }}>
          <span style={{ color: GOLD, fontWeight: 600, fontSize: 13 }}>{selected.size} selected</span>
          <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} style={{
            background: CARD_BG, color: TEXT, border: "1px solid " + BORDER, borderRadius: 6,
            padding: "6px 10px", fontSize: 13,
          }}>
            <option value="">Set category...</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={handleBulkCategorize} disabled={!bulkCategory || bulkUpdating} style={{
            padding: "6px 14px", borderRadius: 6, background: bulkCategory ? GREEN : "#444",
            color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>{bulkUpdating ? "Updating..." : "Apply"}</button>
          <button onClick={() => setSelected(new Set())} style={{
            padding: "6px 10px", borderRadius: 6, background: "transparent",
            color: "#888", border: "1px solid #444", fontSize: 12, cursor: "pointer",
          }}>Clear</button>
        </div>
      )}

      {/* Analyze All Result */}
      {analyzeAllResult && (
        <div style={{
          padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: analyzeAllResult.failed > 0 ? "rgba(204,51,51,0.1)" : "rgba(56,111,74,0.15)",
          border: `1px solid ${analyzeAllResult.failed > 0 ? "#cc3333" : GREEN}`,
          fontSize: 13, color: TEXT,
        }}>
          🤖 Batch analysis complete: <strong>{analyzeAllResult.analyzed}</strong> analyzed, 
          <strong>{analyzeAllResult.failed}</strong> failed, 
          <strong>{analyzeAllResult.skipped}</strong> skipped (unsupported type)
          <button onClick={() => setAnalyzeAllResult(null)} style={{
            marginLeft: 12, background: "transparent", border: "none", color: "#888",
            cursor: "pointer", fontSize: 12,
          }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: GOLD }}>Loading documents...</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>No documents found</div>
      ) : (
        Object.entries(grouped).map(([cat, catDocs]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <h3 style={{ color: GOLD, margin: "0 0 8px", fontSize: 15, borderBottom: "1px solid " + BORDER, paddingBottom: 6 }}>
              {cat} ({catDocs.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {catDocs.map((doc) => (
                <div key={doc.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: selected.has(doc.id) ? "rgba(235,176,3,0.08)" : CARD_BG,
                  borderRadius: 6, border: "1px solid " + (selected.has(doc.id) ? GOLD : BORDER),
                }}>
                  <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggleSelect(doc.id)}
                    style={{ cursor: "pointer", accentColor: GOLD }} />
                  <span style={{ fontSize: 20 }}>{FILE_ICONS[doc.extension?.toLowerCase()] || FILE_ICONS.default}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{formatBytes(doc.size_bytes)}</div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: GREEN, color: "#fff",
                  }}>{doc.category}</span>
                  {doc.ai_category && (
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: "#4488cc", color: "#fff",
                    }} title="AI-detected category">🤖 {doc.ai_category}</span>
                  )}
                  {doc.ai_status === "completed" && !doc.ai_category && (
                    <span style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: 10,
                      background: "#333", color: "#888",
                    }}>✓ Analyzed</span>
                  )}
                  {doc.signedUrl && (
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" style={{
                      padding: "4px 10px", borderRadius: 4, background: NAVY, color: GOLD,
                      textDecoration: "none", fontSize: 12, border: "1px solid " + GOLD,
                    }}>Download</a>
                  )}
                  <button onClick={() => handleAnalyze(doc)} disabled={analyzing === doc.id} style={{
                    padding: "4px 10px", borderRadius: 4, background: analyzing === doc.id ? "#444" : GREEN,
                    color: "#fff", border: "none", fontSize: 12, cursor: "pointer",
                  }}>{analyzing === doc.id ? "..." : "Analyze"}</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{
            padding: "6px 16px", borderRadius: 6, background: CARD_BG, color: TEXT,
            border: "1px solid " + BORDER, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1,
          }}>← Prev</button>
          <span style={{ padding: "6px 12px", color: GOLD, fontSize: 14 }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{
            padding: "6px 16px", borderRadius: 6, background: CARD_BG, color: TEXT,
            border: "1px solid " + BORDER, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1,
          }}>Next →</button>
        </div>
      )}
    </div>
  );
}

