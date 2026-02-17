'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function GlobalSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.cases || data.results || data || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (caseId) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    onSelect?.(caseId);
  };

  const statusColors = {
    active: '#22c55e',
    open: '#22c55e',
    pending: '#f59e0b',
    closed: '#6b7280',
    settled: '#3b82f6',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search cases... (⌘K)"
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
        {/* Search icon */}
        <svg
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebb003" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (query.trim() || loading) && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 998,
            }}
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
              maxHeight: 400,
              overflowY: 'auto',
              padding: '6px 0',
            }}
          >
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#ebb003' }}>
                {/* Spinner */}
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="#ebb003" strokeWidth="3" fill="none" strokeDasharray="31 31" strokeLinecap="round" />
                </svg>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '16px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' }}>
                No results found
              </div>
            ) : (
              results.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(235,176,3,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.client_name || c.clientName || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      {c.ref || c.reference || ''}{c.insurer ? ` · ${c.insurer}` : ''}
                    </div>
                  </div>
                  {(c.status) && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        backgroundColor: (statusColors[c.status?.toLowerCase()] || '#6b7280') + '22',
                        color: statusColors[c.status?.toLowerCase()] || '#6b7280',
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {c.status}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
