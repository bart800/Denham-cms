"use client";
import { useState, useEffect } from "react";

const GOLD = "#ebb003";
const GREEN = "#386f4a";
const CARD_BG = "#000044";
const TEXT = "#e0e0e0";
const BORDER = "#1a1a5e";
const NAVY = "#000066";

const FILE_ICONS = { pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊", jpg: "🖼️", jpeg: "🖼️", png: "🖼️", default: "📎" };
function formatBytes(b) { if (!b) return "—"; if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
function formatCurrency(n) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n); }

export default function CaseEstimatesTab({ caseId }) {
  const [data, setData] = useState({ documents: [], estimates: [], totalAmount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/estimates`);
        setData(await res.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [caseId]);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: GOLD }}>Loading estimates...</div>;

  const { documents, estimates, totalAmount } = data;

  return (
    <div style={{ color: TEXT }}>
      {/* Summary */}
      {estimates.length > 0 && (
        <div style={{ background: GREEN, borderRadius: 8, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "#ccc" }}>Total Estimates</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{formatCurrency(totalAmount)}</div>
          </div>
          <div style={{ fontSize: 13, color: "#ccc" }}>{estimates.length} manual {estimates.length === 1 ? "entry" : "entries"}</div>
        </div>
      )}

      {/* Manual estimate entries */}
      {estimates.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: GOLD, margin: "0 0 10px", fontSize: 15, borderBottom: "1px solid " + BORDER, paddingBottom: 6 }}>Manual Estimates</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {estimates.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: CARD_BG, borderRadius: 6, border: "1px solid " + BORDER }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.type || "Estimate"} — {e.source || "Unknown"}</div>
                  {e.notes && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{e.notes}</div>}
                  {e.date && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{new Date(e.date).toLocaleDateString()}</div>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>{formatCurrency(e.amount || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimate documents */}
      <h3 style={{ color: GOLD, margin: "0 0 10px", fontSize: 15, borderBottom: "1px solid " + BORDER, paddingBottom: 6 }}>
        Estimate Documents ({documents.length})
      </h3>
      {documents.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "#888" }}>No estimate documents found</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {documents.map((doc) => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: CARD_BG, borderRadius: 6, border: "1px solid " + BORDER }}>
              <span style={{ fontSize: 20 }}>{FILE_ICONS[doc.extension?.toLowerCase()] || FILE_ICONS.default}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{formatBytes(doc.size_bytes)} {doc.modified_at ? "• " + new Date(doc.modified_at).toLocaleDateString() : ""}</div>
              </div>
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
