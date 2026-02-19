'use client';
import { useState, useEffect, useCallback } from 'react';

const COLORS = { navy: '#000066', gold: '#ebb003', green: '#386f4a', dark: '#0a0a1a', card: '#111133', border: '#222255', text: '#e0e0e0', muted: '#888', red: '#cc3333' };

const FIELDS = [
  { key: 'client_name', label: 'Client Name' },
  { key: 'status', label: 'Status' },
  { key: 'insurer', label: 'Insurer' },
  { key: 'type', label: 'Type' },
  { key: 'cause_of_loss', label: 'Cause of Loss' },
  { key: 'date_of_loss', label: 'Date of Loss' },
  { key: 'statute_of_limitations', label: 'SOL' },
  { key: 'total_recovery', label: 'Recovery', fmt: 'dollar' },
  { key: 'attorney_name', label: 'Attorney' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'claim_number', label: 'Claim #' },
  { key: 'policy_number', label: 'Policy #' },
];

const TIMELINE_FIELDS = [
  { key: 'date_of_loss', label: 'Date of Loss' },
  { key: 'date_opened', label: 'Date Opened' },
  { key: 'statute_of_limitations', label: 'SOL Deadline' },
];

function CaseSelector({ onSelect, selectedId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cases/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        placeholder="Search cases..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        style={{ width: '100%', padding: '8px 12px', background: COLORS.dark, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, maxHeight: 200, overflowY: 'auto', zIndex: 10 }}>
          {results.map(c => (
            <div key={c.id} onClick={() => { onSelect(c); setQuery(c.client_name || c.ref || ''); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}
              onMouseEnter={e => e.target.style.background = COLORS.navy}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              <strong style={{ color: COLORS.gold }}>{c.ref}</strong> — {c.client_name || c.id} {c.insurer ? `(${c.insurer})` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDiffs(cases) {
  const diffs = {};
  const valid = cases.filter(Boolean);
  if (valid.length < 2) return diffs;
  for (const f of FIELDS) {
    const vals = valid.map(c => String(c[f.key] ?? ''));
    if (new Set(vals).size > 1) diffs[f.key] = true;
  }
  return diffs;
}

function fmtDollar(v) {
  const n = Number(v);
  if (!n) return '—';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtVal(v, fmt) {
  if (v == null || v === '') return '—';
  if (fmt === 'dollar') return fmtDollar(v);
  return String(v);
}

export default function CaseCompare({ onSelectCase }) {
  const [cases, setCases] = useState([null, null]);
  const [caseDetails, setCaseDetails] = useState([null, null]);
  const [viewMode, setViewMode] = useState('fields'); // fields | timeline | financials

  const diffs = getDiffs(caseDetails);

  const loadCaseDetail = useCallback(async (caseBasic, idx) => {
    if (!caseBasic) {
      setCaseDetails(prev => { const n = [...prev]; n[idx] = null; return n; });
      return;
    }
    try {
      const res = await fetch(`/api/cases/${caseBasic.id}`);
      if (res.ok) {
        const data = await res.json();
        const detail = data.case || data;
        // Flatten attorney name
        detail.attorney_name = detail.attorney?.name || detail.attorney_name || '';
        setCaseDetails(prev => { const n = [...prev]; n[idx] = detail; return n; });
      }
    } catch {}
  }, []);

  const setCase = (idx, c) => {
    const next = [...cases];
    next[idx] = c;
    setCases(next);
    loadCaseDetail(c, idx);
    if (onSelectCase) onSelectCase(c);
  };

  const addCase = () => {
    if (cases.length < 3) {
      setCases([...cases, null]);
      setCaseDetails(prev => [...prev, null]);
    }
  };
  const removeCase = idx => {
    if (cases.length > 2) {
      setCases(cases.filter((_, i) => i !== idx));
      setCaseDetails(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const colWidth = cases.length === 3 ? '32%' : '48%';
  const validCases = caseDetails.filter(Boolean);

  return (
    <div style={{ background: COLORS.dark, padding: 24, borderRadius: 12, minHeight: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: COLORS.gold, margin: 0, fontSize: 20 }}>⚖️ Case Comparison</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* View mode tabs */}
          {['fields', 'timeline', 'financials'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{
                background: viewMode === mode ? COLORS.navy : 'transparent',
                border: `1px solid ${viewMode === mode ? COLORS.gold : COLORS.border}`,
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: viewMode === mode ? COLORS.gold : COLORS.muted,
              }}>
              {mode === 'fields' ? '📋 Details' : mode === 'timeline' ? '📅 Timeline' : '💰 Financials'}
            </button>
          ))}
          {cases.length < 3 && (
            <button onClick={addCase} style={{ background: COLORS.green, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              + Add Case
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {cases.map((c, idx) => (
          <div key={idx} style={{ width: colWidth, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, position: 'relative' }}>
            {cases.length > 2 && (
              <button onClick={() => removeCase(idx)} style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none', color: COLORS.muted, cursor: 'pointer', fontSize: 16 }} title="Remove">✕</button>
            )}
            <div style={{ marginBottom: 14 }}>
              <CaseSelector selectedId={c?.id} onSelect={v => setCase(idx, v)} />
            </div>

            {caseDetails[idx] && viewMode === 'fields' && (
              <div>
                {/* Case ref header */}
                <div style={{ padding: '8px 0 12px', borderBottom: `2px solid ${COLORS.gold}`, marginBottom: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{caseDetails[idx].ref}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{caseDetails[idx].status}</div>
                </div>
                {FIELDS.map(f => {
                  const isDiff = diffs[f.key];
                  return (
                    <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                      <span style={{ color: COLORS.muted }}>{f.label}</span>
                      <span style={{ color: isDiff ? COLORS.gold : COLORS.text, fontWeight: isDiff ? 700 : 400, background: isDiff ? 'rgba(235,176,3,0.1)' : 'transparent', padding: isDiff ? '1px 6px' : 0, borderRadius: 4, textAlign: 'right', maxWidth: '60%' }}>
                        {fmtVal(caseDetails[idx][f.key], f.fmt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {caseDetails[idx] && viewMode === 'timeline' && (
              <div>
                <div style={{ padding: '8px 0 12px', borderBottom: `2px solid ${COLORS.gold}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{caseDetails[idx].ref}</div>
                </div>
                {TIMELINE_FIELDS.map(f => {
                  const val = caseDetails[idx][f.key];
                  const isSol = f.key === 'statute_of_limitations';
                  let extra = '';
                  if (isSol && val) {
                    const days = Math.ceil((new Date(val + 'T00:00:00') - new Date()) / 86400000);
                    extra = days > 0 ? ` (${days}d left)` : ` (EXPIRED)`;
                  }
                  return (
                    <div key={f.key} style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isSol && val ? (Math.ceil((new Date(val + 'T00:00:00') - new Date()) / 86400000) < 90 ? COLORS.red : COLORS.text) : COLORS.text }}>
                        {val || '—'}{extra}
                      </div>
                    </div>
                  );
                })}
                {/* Visual timeline bar */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>Case Timeline</div>
                  <TimelineBar caseData={caseDetails[idx]} />
                </div>
              </div>
            )}

            {caseDetails[idx] && viewMode === 'financials' && (
              <div>
                <div style={{ padding: '8px 0 12px', borderBottom: `2px solid ${COLORS.gold}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{caseDetails[idx].ref}</div>
                </div>
                <FinancialCard label="Total Recovery" value={caseDetails[idx].total_recovery} />
                <FinancialCard label="Attorney Fees" value={caseDetails[idx].attorney_fees} />
                <FinancialCard label="Negotiations" value={caseDetails[idx].negotiations?.length || 0} plain />
                {(caseDetails[idx].negotiations || []).slice(0, 5).map((n, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 12, borderBottom: `1px solid ${COLORS.border}` }}>
                    <span style={{ color: COLORS.muted }}>{n.type?.replace(/_/g, ' ')} — {n.date}</span>
                    <span style={{ color: COLORS.gold, fontWeight: 600 }}>{fmtDollar(n.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {!caseDetails[idx] && <p style={{ color: COLORS.muted, textAlign: 'center', marginTop: 40, fontSize: 13 }}>Search to select a case</p>}
          </div>
        ))}
      </div>

      {/* Similarity note */}
      {validCases.length >= 2 && (
        <div style={{ marginTop: 20, padding: 16, background: COLORS.card, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold, marginBottom: 8 }}>📊 Comparison Summary</div>
          <SimilaritySummary cases={validCases} />
        </div>
      )}
    </div>
  );
}

function FinancialCard({ label, value, plain }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.gold }}>
        {plain ? value : fmtDollar(value)}
      </div>
    </div>
  );
}

function TimelineBar({ caseData }) {
  const dol = caseData.date_of_loss ? new Date(caseData.date_of_loss) : null;
  const opened = caseData.date_opened ? new Date(caseData.date_opened) : null;
  const sol = caseData.statute_of_limitations ? new Date(caseData.statute_of_limitations) : null;
  const now = new Date();

  if (!dol) return <div style={{ fontSize: 12, color: COLORS.muted }}>No timeline data</div>;

  const start = dol;
  const end = sol || new Date(now.getTime() + 365 * 86400000);
  const range = end - start;
  const pct = (d) => Math.max(0, Math.min(100, ((d - start) / range) * 100));

  return (
    <div style={{ position: 'relative', height: 30, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
      {/* Progress to now */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct(now)}%`, background: `${COLORS.green}30`, borderRadius: 4 }} />
      {/* DOL marker */}
      <div style={{ position: 'absolute', left: `${pct(dol)}%`, top: 0, bottom: 0, width: 2, background: COLORS.gold }} title={`DOL: ${caseData.date_of_loss}`} />
      {/* Now marker */}
      <div style={{ position: 'absolute', left: `${pct(now)}%`, top: 0, bottom: 0, width: 2, background: COLORS.green }} title="Today" />
      {/* SOL marker */}
      {sol && <div style={{ position: 'absolute', left: `${pct(sol)}%`, top: 0, bottom: 0, width: 2, background: COLORS.red }} title={`SOL: ${caseData.statute_of_limitations}`} />}
      {/* Labels */}
      <div style={{ position: 'absolute', left: 4, bottom: 2, fontSize: 9, color: COLORS.gold }}>DOL</div>
      {sol && <div style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 9, color: COLORS.red }}>SOL</div>}
    </div>
  );
}

function SimilaritySummary({ cases }) {
  const similarities = [];
  const differences = [];

  if (cases.length < 2) return null;

  // Check key fields
  const checks = [
    { key: 'insurer', label: 'insurer' },
    { key: 'type', label: 'case type' },
    { key: 'jurisdiction', label: 'jurisdiction' },
    { key: 'cause_of_loss', label: 'cause of loss' },
    { key: 'status', label: 'status' },
  ];

  for (const { key, label } of checks) {
    const vals = cases.map(c => c[key]).filter(Boolean);
    if (vals.length >= 2 && new Set(vals).size === 1) {
      similarities.push(`Same ${label}: ${vals[0]}`);
    } else if (vals.length >= 2) {
      differences.push(`Different ${label}: ${[...new Set(vals)].join(' vs ')}`);
    }
  }

  // Recovery comparison
  const recoveries = cases.map(c => Number(c.total_recovery) || 0);
  if (recoveries.some(r => r > 0)) {
    const max = Math.max(...recoveries);
    const min = Math.min(...recoveries);
    if (max > 0 && min > 0 && max !== min) {
      differences.push(`Recovery range: ${fmtDollar(min)} — ${fmtDollar(max)}`);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: COLORS.green, fontWeight: 600, marginBottom: 6 }}>✅ Similarities</div>
        {similarities.length ? similarities.map((s, i) => (
          <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {s}</div>
        )) : <div style={{ fontSize: 12, color: COLORS.muted }}>No matching fields</div>}
      </div>
      <div>
        <div style={{ fontSize: 11, color: COLORS.gold, fontWeight: 600, marginBottom: 6 }}>⚡ Differences</div>
        {differences.length ? differences.map((d, i) => (
          <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {d}</div>
        )) : <div style={{ fontSize: 12, color: COLORS.muted }}>Cases are identical on key fields</div>}
      </div>
    </div>
  );
}
