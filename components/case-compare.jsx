'use client';
import { useState, useEffect, useCallback } from 'react';

const COLORS = { navy: '#000066', gold: '#ebb003', green: '#386f4a', dark: '#0a0a1a', card: '#111133', border: '#222255', text: '#e0e0e0', muted: '#888', red: '#cc3333' };

const FIELDS = [
  { key: 'client_name', label: 'Client Name' },
  { key: 'status', label: 'Status' },
  { key: 'insurer', label: 'Insurer' },
  { key: 'case_type', label: 'Type' },
  { key: 'date_of_loss', label: 'Date of Loss' },
  { key: 'statute_of_limitations', label: 'SOL' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'attorney', label: 'Attorney' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
  { key: 'claim_number', label: 'Claim #' },
  { key: 'policy_number', label: 'Policy #' },
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
            <div key={c.id} onClick={() => { onSelect(c); setQuery(c.client_name || ''); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}
              onMouseEnter={e => e.target.style.background = COLORS.navy}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              {c.client_name || c.id} {c.case_type ? `— ${c.case_type}` : ''}
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

export default function CaseCompare({ onSelectCase }) {
  const [cases, setCases] = useState([null, null]);

  const diffs = getDiffs(cases);

  const setCase = (idx, c) => {
    const next = [...cases];
    next[idx] = c;
    setCases(next);
    if (onSelectCase) onSelectCase(c);
  };

  const addCase = () => { if (cases.length < 3) setCases([...cases, null]); };
  const removeCase = idx => { if (cases.length > 2) setCases(cases.filter((_, i) => i !== idx)); };

  const colWidth = cases.length === 3 ? '32%' : '48%';

  return (
    <div style={{ background: COLORS.dark, padding: 24, borderRadius: 12, minHeight: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: COLORS.gold, margin: 0, fontSize: 20 }}>Case Comparison</h2>
        {cases.length < 3 && (
          <button onClick={addCase} style={{ background: COLORS.green, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            + Add Case
          </button>
        )}
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
            {c && (
              <div>
                {FIELDS.map(f => {
                  const isDiff = diffs[f.key];
                  return (
                    <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                      <span style={{ color: COLORS.muted }}>{f.label}</span>
                      <span style={{ color: isDiff ? COLORS.gold : COLORS.text, fontWeight: isDiff ? 700 : 400, background: isDiff ? 'rgba(235,176,3,0.1)' : 'transparent', padding: isDiff ? '1px 6px' : 0, borderRadius: 4 }}>
                        {c[f.key] ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {!c && <p style={{ color: COLORS.muted, textAlign: 'center', marginTop: 40, fontSize: 13 }}>Search to select a case</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
