'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const TYPE_CONFIG = {
  case: { icon: '📁', label: 'Cases', color: '#ebb003' },
  document: { icon: '📄', label: 'Documents', color: '#60a5fa' },
  note: { icon: '📝', label: 'Notes', color: '#a78bfa' },
  email: { icon: '✉️', label: 'Emails', color: '#34d399' },
  call: { icon: '📞', label: 'Calls', color: '#f472b6' },
};

const SCOPE_KEYS = ['cases', 'documents', 'notes', 'emails', 'calls'];

export default function UniversalSearch({ onSelect, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeScopes, setActiveScopes] = useState(new Set(SCOPE_KEYS));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Cmd+K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q, scopes) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const scopeParam = [...scopes].join(',');
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scopeParam}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setSelectedIndex(0);
      } else {
        setResults(null);
      }
    } catch {
      setResults(null);
    }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val, activeScopes), 300);
  };

  const toggleScope = (scope) => {
    setActiveScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        if (next.size > 1) next.delete(scope);
      } else {
        next.add(scope);
      }
      // Re-search with new scopes
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(query, next), 200);
      return next;
    });
  };

  // Flatten all results for keyboard navigation
  const flatResults = results
    ? SCOPE_KEYS.flatMap((scope) => {
        const section = results[scope];
        return section?.data || [];
      })
    : [];

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      handleItemSelect(flatResults[selectedIndex]);
    }
  };

  const handleItemSelect = (item) => {
    setOpen(false);
    setQuery('');
    setResults(null);

    if (item._type === 'case') {
      onSelect?.(item.id);
    } else if (item.case_id) {
      // Navigate to case, then optionally to the specific item
      onNavigate?.({ caseId: item.case_id, type: item._type, itemId: item.id });
      if (!onNavigate) onSelect?.(item.case_id);
    }
  };

  const statusColors = {
    open: '#22c55e',
    'presuit demand': '#f59e0b',
    'litigation-filed': '#ef4444',
    settled: '#3b82f6',
    settlement: '#3b82f6',
    closed: '#6b7280',
    referred: '#8b5cf6',
  };

  const renderItem = (item, index) => {
    const config = TYPE_CONFIG[item._type] || { icon: '❓', color: '#888' };
    const isSelected = index === selectedIndex;

    return (
      <div
        key={`${item._type}-${item.id}`}
        onClick={() => handleItemSelect(item)}
        style={{
          padding: '10px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: isSelected ? 'rgba(235,176,3,0.12)' : 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(235,176,3,0.1)';
          setSelectedIndex(index);
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{config.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {item._type === 'case' && (
            <>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.client_name}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {item.ref}{item.insurer ? ` · ${item.insurer}` : ''}{item.attorney ? ` · ${item.attorney}` : ''}
              </div>
            </>
          )}
          {item._type === 'document' && (
            <>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.filename}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {item.case_ref ? `${item.case_ref} · ${item.client_name}` : 'Unlinked'}{item.category ? ` · ${item.category}` : ''}
              </div>
            </>
          )}
          {item._type === 'note' && (
            <>
              <div style={{ color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.content_preview}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {item.case_ref ? `${item.case_ref} · ${item.client_name}` : ''}{item.author ? ` · ${item.author}` : ''}
              </div>
            </>
          )}
          {item._type === 'email' && (
            <>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.subject || '(no subject)'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {item.direction === 'inbound' ? '← ' : '→ '}{item.from}{item.case_ref ? ` · ${item.case_ref}` : ''}
              </div>
            </>
          )}
          {item._type === 'call' && (
            <>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.caller_name || item.external_number || 'Unknown'}
                {item.duration_seconds ? ` · ${Math.floor(item.duration_seconds / 60)}m` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {item.case_ref ? `${item.case_ref} · ${item.client_name}` : 'Unmatched'}
                {item.ai_summary_preview ? ` · ${item.ai_summary_preview.slice(0, 80)}...` : ''}
              </div>
            </>
          )}
        </div>
        {item._type === 'case' && item.status && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 9999,
              backgroundColor: (statusColors[item.status?.toLowerCase()] || '#6b7280') + '22',
              color: statusColors[item.status?.toLowerCase()] || '#6b7280',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {item.status}
          </span>
        )}
      </div>
    );
  };

  let flatIndex = 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search everything... (⌘K)"
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(235,176,3,0.3)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <svg
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebb003" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (query.trim().length >= 2 || loading) && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              backgroundColor: '#000066',
              border: '1px solid rgba(235,176,3,0.4)',
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              zIndex: 999,
              maxHeight: 500,
              overflowY: 'auto',
              padding: 0,
            }}
          >
            {/* Scope filters */}
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
              {SCOPE_KEYS.map((scope) => {
                const config = TYPE_CONFIG[scope.replace(/s$/, '')] || {};
                const active = activeScopes.has(scope);
                return (
                  <button
                    key={scope}
                    onClick={(e) => { e.stopPropagation(); toggleScope(scope); }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 9999,
                      border: `1px solid ${active ? config.color || '#ebb003' : 'rgba(255,255,255,0.15)'}`,
                      backgroundColor: active ? (config.color || '#ebb003') + '22' : 'transparent',
                      color: active ? config.color || '#ebb003' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {config.icon} {config.label}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#ebb003' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="#ebb003" strokeWidth="3" fill="none" strokeDasharray="31 31" strokeLinecap="round" />
                </svg>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : !results || results.total_hits === 0 ? (
              <div style={{ padding: '16px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' }}>
                No results found
              </div>
            ) : (
              <>
                {/* Results grouped by type */}
                {SCOPE_KEYS.map((scope) => {
                  const section = results[scope];
                  if (!section?.data?.length) return null;
                  const singularType = scope.replace(/s$/, '');
                  const config = TYPE_CONFIG[singularType] || {};

                  return (
                    <div key={scope}>
                      <div style={{
                        padding: '8px 16px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: config.color || '#888',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {config.label} ({section.total})
                      </div>
                      {section.data.map((item) => {
                        const idx = flatIndex++;
                        return renderItem(item, idx);
                      })}
                    </div>
                  );
                })}

                {/* Total count */}
                <div style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.35)',
                  textAlign: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {results.total_hits} results · ↑↓ navigate · ↵ select · esc close
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
