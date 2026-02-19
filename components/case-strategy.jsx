'use client';
import React, { useState, useEffect } from 'react';

const B = {
  bg: "#0a1628", card: "#111d33", cardHover: "#162340",
  gold: "#c8a951", green: "#34d399", danger: "#ef4444", warning: "#f59e0b",
  txt: "#e2e8f0", txtM: "#94a3b8", txtD: "#64748b",
  border: "#1e2d4a", accent: "#3b82f6",
};

const S = {
  card: { background: B.card, borderRadius: 12, padding: 20, border: `1px solid ${B.border}`, marginBottom: 16 },
  mono: { fontFamily: "'JetBrains Mono', monospace" },
  label: { fontSize: 11, color: B.txtD, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 },
};

const fmt$ = (n) => n != null ? `$${Number(n).toLocaleString()}` : "—";

export default function CaseStrategy({ caseData }) {
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!caseData?.id) return;
    setLoading(true);
    fetch(`/api/ai/strategy?caseId=${caseData.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setStrategy(data.strategy);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [caseData?.id]);

  if (loading) return (
    <div style={{ ...S.card, textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
      <div style={{ color: B.txtM, fontSize: 14 }}>Analyzing case strategy...</div>
    </div>
  );

  if (error) return (
    <div style={{ ...S.card, borderColor: B.danger }}>
      <div style={{ color: B.danger, fontSize: 14 }}>Strategy analysis failed: {error}</div>
    </div>
  );

  if (!strategy) return null;

  const s = strategy;
  const strengthColor = s.strengthScore >= 70 ? B.green : s.strengthScore >= 45 ? B.gold : B.danger;

  return (
    <div>
      {/* Top Summary Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {/* Strength Score */}
        <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
          <div style={S.label}>Case Strength</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: strengthColor, ...S.mono }}>{s.strengthScore}</div>
          <div style={{ fontSize: 11, color: B.txtD }}>/100</div>
        </div>

        {/* SOL */}
        <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
          <div style={S.label}>SOL Remaining</div>
          <div style={{
            fontSize: 28, fontWeight: 700, ...S.mono,
            color: s.solDays == null ? B.txtD : s.solDays < 30 ? B.danger : s.solDays < 90 ? B.warning : B.green
          }}>
            {s.solDays != null ? `${s.solDays}d` : "N/A"}
          </div>
          <div style={{ fontSize: 11, color: B.txtD }}>
            {s.solDays != null && s.solDays < 0 ? "EXPIRED" : s.solDays != null && s.solDays < 30 ? "CRITICAL" : "days"}
          </div>
        </div>

        {/* Negotiation Gap */}
        <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
          <div style={S.label}>Negotiation Gap</div>
          <div style={{ fontSize: 28, fontWeight: 700, ...S.mono, color: s.negotiationSummary.gapPercent != null ? B.gold : B.txtD }}>
            {s.negotiationSummary.gapPercent != null ? `${s.negotiationSummary.gapPercent}%` : "—"}
          </div>
          <div style={{ fontSize: 11, color: B.txtD }}>{s.negotiationSummary.totalRounds} round{s.negotiationSummary.totalRounds !== 1 ? "s" : ""}</div>
        </div>

        {/* Settlement Range */}
        <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
          <div style={S.label}>Est. Settlement Range</div>
          {s.settlementRange ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, ...S.mono, color: B.green }}>{fmt$(s.settlementRange.mid)}</div>
              <div style={{ fontSize: 11, color: B.txtD }}>{fmt$(s.settlementRange.low)} – {fmt$(s.settlementRange.high)}</div>
            </>
          ) : (
            <div style={{ fontSize: 18, color: B.txtD }}>—</div>
          )}
        </div>
      </div>

      {/* Risks */}
      {s.risks.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: B.txt }}>⚠️ Risk Assessment</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {s.risks.map((r, i) => (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 8,
                background: r.severity === "critical" ? `${B.danger}15` : r.severity === "warning" ? `${B.warning}15` : `${B.accent}10`,
                borderLeft: `3px solid ${r.severity === "critical" ? B.danger : r.severity === "warning" ? B.warning : B.accent}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                      color: r.severity === "critical" ? B.danger : r.severity === "warning" ? B.warning : B.accent,
                      marginRight: 8,
                    }}>{r.severity}</span>
                    <span style={{ fontSize: 11, color: B.txtD }}>{r.category}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: B.txt, marginTop: 4 }}>{r.message}</div>
                <div style={{ fontSize: 12, color: B.txtM, marginTop: 4, fontStyle: "italic" }}>→ {r.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div style={S.card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: B.txt }}>🎯 Strategic Recommendations</h3>
        {s.recommendations.length === 0 ? (
          <div style={{ color: B.txtM, fontSize: 13 }}>No specific recommendations at this time.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {s.recommendations.map((r, i) => (
              <div key={i} style={{
                padding: "12px 14px", borderRadius: 8, background: B.bg,
                borderLeft: `3px solid ${r.priority === "high" ? B.gold : r.priority === "medium" ? B.accent : B.txtD}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4,
                    background: r.priority === "high" ? `${B.gold}25` : r.priority === "medium" ? `${B.accent}20` : `${B.txtD}20`,
                    color: r.priority === "high" ? B.gold : r.priority === "medium" ? B.accent : B.txtD,
                  }}>{r.priority}</span>
                  <span style={{ fontSize: 10, color: B.txtD }}>{r.category}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.txt }}>{r.title}</div>
                <div style={{ fontSize: 12, color: B.txtM, marginTop: 4, lineHeight: 1.5 }}>{r.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benchmarks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={S.card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: B.txt }}>
            📊 vs. Same Insurer {s.insurer ? `(${s.insurer})` : ""}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={S.label}>Cases</div>
              <div style={{ ...S.mono, fontSize: 18, color: B.txt }}>{s.benchmarks.sameInsurer.totalCases}</div>
            </div>
            <div>
              <div style={S.label}>Settled</div>
              <div style={{ ...S.mono, fontSize: 18, color: B.green }}>{s.benchmarks.sameInsurer.settledCount}</div>
            </div>
            <div>
              <div style={S.label}>Avg Recovery</div>
              <div style={{ ...S.mono, fontSize: 14, color: B.gold }}>{s.benchmarks.sameInsurer.avgRecovery ? fmt$(s.benchmarks.sameInsurer.avgRecovery) : "—"}</div>
            </div>
            <div>
              <div style={S.label}>Denial Rate</div>
              <div style={{ ...S.mono, fontSize: 14, color: s.benchmarks.sameInsurer.denialRate > 50 ? B.danger : B.txtM }}>
                {s.benchmarks.sameInsurer.denialRate != null ? `${s.benchmarks.sameInsurer.denialRate}%` : "—"}
              </div>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: B.txt }}>
            📊 vs. Same Loss Type {s.caseType ? `(${s.caseType})` : ""}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={S.label}>Cases</div>
              <div style={{ ...S.mono, fontSize: 18, color: B.txt }}>{s.benchmarks.sameType.totalCases}</div>
            </div>
            <div>
              <div style={S.label}>Settled</div>
              <div style={{ ...S.mono, fontSize: 18, color: B.green }}>{s.benchmarks.sameType.settledCount}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={S.label}>Avg Recovery</div>
              <div style={{ ...S.mono, fontSize: 14, color: B.gold }}>{s.benchmarks.sameType.avgRecovery ? fmt$(s.benchmarks.sameType.avgRecovery) : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation & Estimate Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={S.card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: B.txt }}>💰 Negotiation Position</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Last Demand</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.gold }}>
                {s.negotiationSummary.lastDemand ? fmt$(s.negotiationSummary.lastDemand.amount) : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Last Offer</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.accent }}>
                {s.negotiationSummary.lastOffer ? fmt$(s.negotiationSummary.lastOffer.amount) : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${B.border}`, paddingTop: 8 }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Gap</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.warning }}>
                {s.negotiationSummary.gapPercent != null ? `${s.negotiationSummary.gapPercent}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: B.txt }}>📋 Task Progress</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Total Tasks</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.txt }}>{s.taskSummary.total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Completed</span>
              <span style={{ ...S.mono, fontSize: 13, color: B.green }}>{s.taskSummary.completed}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: B.txtM }}>Overdue</span>
              <span style={{ ...S.mono, fontSize: 13, color: s.taskSummary.overdue > 0 ? B.danger : B.txtD }}>{s.taskSummary.overdue}</span>
            </div>
            {s.taskSummary.total > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ height: 6, borderRadius: 3, background: B.bg, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3, background: B.green,
                    width: `${(s.taskSummary.completed / s.taskSummary.total * 100).toFixed(0)}%`,
                    transition: "width 0.3s ease",
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
