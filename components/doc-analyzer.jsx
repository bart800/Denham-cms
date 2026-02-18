"use client";
import { useState } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";
const GREEN = "#386f4a";
const DARK_BG = "#000044";
const CARD_BG = "#0a0a5c";
const TEXT = "#e0e0e0";
const MUTED = "#9999bb";

const TYPE_COLORS = {
  denial_letter: "#cc3333",
  estimate: GOLD,
  policy: "#6688cc",
  pleading: "#cc6633",
  correspondence: GREEN,
  unknown: MUTED,
};

const TYPE_LABELS = {
  denial_letter: "Denial Letter",
  estimate: "Estimate",
  policy: "Policy Document",
  pleading: "Pleading",
  correspondence: "Correspondence",
  unknown: "Unknown",
};

export default function DocAnalyzer({ document }) {
  const [analysis, setAnalysis] = useState(document?.analysis || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/docs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: document.id, storage_path: document.storage_path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const card = {
    background: CARD_BG,
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    border: `1px solid ${NAVY}`,
  };

  return (
    <div style={{ color: TEXT, fontFamily: "system-ui, sans-serif" }}>
      {/* Document Info Card */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{document?.filename || "Document"}</h3>
            <span style={{ color: MUTED, fontSize: 13 }}>
              {document?.extension?.toUpperCase()} • {document?.category || "Uncategorized"}
              {document?.size_bytes ? ` • ${(document.size_bytes / 1024).toFixed(0)} KB` : ""}
            </span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              background: loading ? MUTED : GOLD,
              color: NAVY,
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Analyzing..." : analysis ? "Re-Analyze" : "Analyze"}
          </button>
        </div>
        {document?.download_url && (
          <a href={document.download_url} target="_blank" rel="noreferrer" style={{ color: GOLD, fontSize: 13 }}>
            Download Document ↗
          </a>
        )}
      </div>

      {error && (
        <div style={{ ...card, borderColor: "#cc3333", color: "#ff6666" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Type Badge + Summary */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{
                background: TYPE_COLORS[analysis.doc_type] || MUTED,
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>
                {TYPE_LABELS[analysis.doc_type] || analysis.doc_type}
              </span>
              <span style={{ color: MUTED, fontSize: 12 }}>
                Analyzed {new Date(analysis.analyzed_at).toLocaleString()}
              </span>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14 }}>{analysis.summary}</p>
          </div>

          {/* Denial Letter Specifics */}
          {analysis.denial_info && (
            <div style={{ ...card, borderColor: "#cc3333", borderWidth: 2 }}>
              <h4 style={{ color: "#ff6666", margin: "0 0 10px", fontSize: 15 }}>⚠️ Denial Details</h4>
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: MUTED, fontSize: 12 }}>REASON FOR DENIAL</span>
                {analysis.denial_info.denial_reasons.map((r, i) => (
                  <p key={i} style={{ margin: "4px 0", color: "#ff9999", fontWeight: 600, fontSize: 14 }}>{r}</p>
                ))}
              </div>
              {analysis.denial_info.policy_provisions_cited.length > 0 && (
                <div>
                  <span style={{ color: MUTED, fontSize: 12 }}>PROVISIONS CITED</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {analysis.denial_info.policy_provisions_cited.map((p, i) => (
                      <span key={i} style={{ background: NAVY, padding: "3px 8px", borderRadius: 4, fontSize: 12, color: TEXT }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estimate Specifics */}
          {analysis.estimate_info && (
            <div style={{ ...card, borderColor: GOLD, borderWidth: 2 }}>
              <h4 style={{ color: GOLD, margin: "0 0 10px", fontSize: 15 }}>📋 Estimate Details</h4>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {analysis.estimate_info.total_amount && (
                  <div>
                    <span style={{ color: MUTED, fontSize: 12 }}>TOTAL AMOUNT</span>
                    <p style={{ margin: "4px 0", color: GOLD, fontWeight: 700, fontSize: 22 }}>{analysis.estimate_info.total_amount}</p>
                  </div>
                )}
                {analysis.estimate_info.line_items_count && (
                  <div>
                    <span style={{ color: MUTED, fontSize: 12 }}>LINE ITEMS</span>
                    <p style={{ margin: "4px 0", fontSize: 18, fontWeight: 600 }}>{analysis.estimate_info.line_items_count}</p>
                  </div>
                )}
                {analysis.estimate_info.contractor_name && (
                  <div>
                    <span style={{ color: MUTED, fontSize: 12 }}>CONTRACTOR</span>
                    <p style={{ margin: "4px 0", fontSize: 14 }}>{analysis.estimate_info.contractor_name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Data Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Dates */}
            <div style={card}>
              <h4 style={{ color: GOLD, margin: "0 0 10px", fontSize: 14 }}>📅 Key Dates</h4>
              {analysis.dates?.length > 0 ? (
                analysis.dates.map((d, i) => (
                  <div key={i} style={{ padding: "3px 0", fontSize: 13, borderBottom: `1px solid ${NAVY}` }}>{d}</div>
                ))
              ) : (
                <span style={{ color: MUTED, fontSize: 13 }}>No dates found</span>
              )}
            </div>

            {/* Amounts */}
            <div style={card}>
              <h4 style={{ color: GREEN, margin: "0 0 10px", fontSize: 14 }}>💰 Dollar Amounts</h4>
              {analysis.amounts?.length > 0 ? (
                analysis.amounts.map((a, i) => (
                  <div key={i} style={{ padding: "3px 0", fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${NAVY}` }}>{a}</div>
                ))
              ) : (
                <span style={{ color: MUTED, fontSize: 13 }}>No amounts found</span>
              )}
            </div>

            {/* Parties */}
            <div style={card}>
              <h4 style={{ color: TEXT, margin: "0 0 10px", fontSize: 14 }}>👤 Key Parties</h4>
              {analysis.parties?.length > 0 ? (
                analysis.parties.map((p, i) => (
                  <div key={i} style={{ padding: "3px 0", fontSize: 13, borderBottom: `1px solid ${NAVY}` }}>{p}</div>
                ))
              ) : (
                <span style={{ color: MUTED, fontSize: 13 }}>No names extracted</span>
              )}
            </div>

            {/* Action Items */}
            <div style={card}>
              <h4 style={{ color: GOLD, margin: "0 0 10px", fontSize: 14 }}>✅ Action Items</h4>
              {analysis.action_items?.length > 0 ? (
                analysis.action_items.map((a, i) => (
                  <div key={i} style={{ padding: "4px 0", fontSize: 13, display: "flex", gap: 6, borderBottom: `1px solid ${NAVY}` }}>
                    <span style={{ color: GREEN }}>•</span> {a}
                  </div>
                ))
              ) : (
                <span style={{ color: MUTED, fontSize: 13 }}>No action items</span>
              )}
            </div>
          </div>

          {/* Flags */}
          {analysis.flags?.length > 0 && (
            <div style={{ ...card, borderColor: GOLD }}>
              <h4 style={{ color: GOLD, margin: "0 0 8px", fontSize: 14 }}>⚠️ Flags</h4>
              {analysis.flags.map((f, i) => (
                <p key={i} style={{ margin: "4px 0", fontSize: 13, color: GOLD }}>{f}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
