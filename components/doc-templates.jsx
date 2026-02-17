"use client";
import { useState, useEffect, useRef } from "react";

const NAVY = "#000066";
const GOLD = "#ebb003";

export default function DocTemplates({ caseId, caseName }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, []);

  async function generate(tpl) {
    if (!caseId) return alert("No case selected.");
    setSelected(tpl.id);
    setLoading(true);
    setHtml("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: tpl.id, caseId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHtml(data.html);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function printDoc() {
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  async function copyToClipboard() {
    try {
      const blob = new Blob([html], { type: "text/html" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy as text
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const cardStyle = (isSelected) => ({
    background: isSelected ? NAVY : "#1a1a2e",
    border: isSelected ? `2px solid ${GOLD}` : "2px solid #333",
    borderRadius: 10,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.2s",
  });

  return (
    <div style={{ display: "flex", gap: 24, height: "100%", minHeight: 600 }}>
      {/* Left: Template Grid */}
      <div style={{ width: 340, flexShrink: 0 }}>
        <h3 style={{ color: GOLD, margin: "0 0 16px 0", fontSize: 18 }}>📄 Document Templates</h3>
        {caseName && (
          <div style={{ color: "#aaa", fontSize: 13, marginBottom: 16 }}>
            Case: <span style={{ color: "#fff" }}>{caseName}</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => generate(tpl)}
              style={cardStyle(selected === tpl.id)}
              onMouseEnter={(e) => {
                if (selected !== tpl.id) e.currentTarget.style.borderColor = GOLD;
              }}
              onMouseLeave={(e) => {
                if (selected !== tpl.id) e.currentTarget.style.borderColor = "#333";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{tpl.icon}</span>
                <div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{tpl.name}</div>
                  <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>{tpl.description}</div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  background: "rgba(235,176,3,0.15)",
                  color: GOLD,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {tpl.category}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ color: "#fff", margin: 0, flex: 1, fontSize: 16 }}>
            {html
              ? `Preview: ${templates.find((t) => t.id === selected)?.name || ""}`
              : "Select a template to generate"}
          </h3>
          {html && (
            <>
              <button
                onClick={printDoc}
                style={{
                  background: NAVY,
                  color: "#fff",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                🖨️ Print / Save PDF
              </button>
              <button
                onClick={copyToClipboard}
                style={{
                  background: copied ? "#1a6b1a" : "#1a1a2e",
                  color: "#fff",
                  border: "1px solid #555",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {copied ? "✅ Copied!" : "📋 Copy to Clipboard"}
              </button>
            </>
          )}
        </div>

        {/* Document Preview */}
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 8,
            overflow: "auto",
            border: "1px solid #333",
            minHeight: 400,
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#666",
                fontSize: 16,
              }}
            >
              <div>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid #ddd",
                    borderTop: `3px solid ${NAVY}`,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                Generating document...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          ) : html ? (
            <iframe
              ref={previewRef}
              srcDoc={html}
              style={{ width: "100%", height: "100%", border: "none", minHeight: 500 }}
              title="Document Preview"
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#999",
                fontSize: 15,
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 48, opacity: 0.3 }}>📄</span>
              <span>Click a template to generate a document</span>
              {!caseId && (
                <span style={{ color: "#cc4444", fontSize: 13 }}>⚠️ No case selected</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
