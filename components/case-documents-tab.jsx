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
  "PA Files","Estimates","Intake","Client Docs","Policy",
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
        body: JSON.stringify({ documentId: doc.id, storagePath: doc.storage_path }),
      });
    } catch (e) { console.error(e); }
    setAnalyzing(null);
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
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid " + BORDER, cursor: "pointer",
            background: !activeCategory ? GOLD : CARD_BG, color: !activeCategory ? "#000" : TEXT,
            fontWeight: !activeCategory ? 700 : 400, fontSize: 13,
          }}
        >All ({total})</button>
        {ALL_CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid " + BORDER, cursor: "pointer",
            background: activeCategory === cat ? GOLD : CARD_BG, color: activeCategory === cat ? "#000" : TEXT,
            fontWeight: activeCategory === cat ? 700 : 400, fontSize: 13,
          }}>{cat}</button>
        ))}
      </div>

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
                  background: CARD_BG, borderRadius: 6, border: "1px solid " + BORDER,
                }}>
                  <span style={{ fontSize: 20 }}>{FILE_ICONS[doc.extension?.toLowerCase()] || FILE_ICONS.default}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{formatBytes(doc.size_bytes)}</div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: GREEN, color: "#fff",
                  }}>{doc.category}</span>
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
