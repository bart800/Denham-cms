"use client";
import { useState, useEffect } from "react";

const GOLD = "#ebb003";
const GREEN = "#386f4a";
const CARD_BG = "#000044";
const TEXT = "#e0e0e0";
const BORDER = "#1a1a5e";
const NAVY = "#000066";

const FILE_ICONS = { pdf: "📄", doc: "📝", docx: "📝", default: "📎" };
function formatBytes(b) { if (!b) return "—"; if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }

export default function CasePleadingsTab({ caseId }) {
  const [data, setData] = useState({ documents: [], pleadings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/pleadings`);
        setData(await res.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [caseId]);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: GOLD }}>Loading pleadings...</div>;

  const { documents, pleadings } = data;

  return (
    <div style={{ color: TEXT }}>
      {/* Manual pleading entries */}
      {pleadings.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: GOLD, margin: "0 0 10px", fontSize: 15, borderBottom: "1px solid " + BORDER, paddingBottom: 6 }}>Manual Entries</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pleadings.map((p) => (
              <div key={p.id} style={{ padding: "10px 14px", background: CARD_BG, borderRadius: 6, border: "1px solid " + BORDER }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.title || "Pleading"}</div>
                {p.notes && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{p.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pleading documents */}
      <h3 style={{ color: GOLD, margin: "0 0 10px", fontSize: 15, borderBottom: "1px solid " + BORDER, paddingBottom: 6 }}>
        Pleading Documents ({documents.length})
      </h3>
      {documents.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "#888" }}>No pleading documents found</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {documents.map((doc) => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: CARD_BG, borderRadius: 6, border: "1px solid " + BORDER }}>
              <span style={{ fontSize: 20 }}>{FILE_ICONS[doc.extension?.toLowerCase()] || FILE_ICONS.default}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {formatBytes(doc.size_bytes)}
                  {doc.modified_at ? " • " + new Date(doc.modified_at).toLocaleDateString() : ""}
                </div>
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: doc.category === "E-Pleadings" ? NAVY : GREEN,
                color: doc.category === "E-Pleadings" ? GOLD : "#fff",
                border: doc.category === "E-Pleadings" ? "1px solid " + GOLD : "none",
              }}>{doc.category}</span>
              {doc.signedUrl && (
                <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" style={{
                  padding: "4px 10px", borderRadius: 4, background: NAVY, color: GOLD,
                  textDecoration: "none", fontSize: 12, border: "1px solid " + GOLD,
                }}>Download</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
