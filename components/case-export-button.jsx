'use client';
import React, { useState } from 'react';

export default function CaseExportButton({ caseId }) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    const url = `/api/cases/${caseId}/export`;
    window.open(url, '_blank');
    // Reset loading after a brief delay (the file downloads/opens in new tab)
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading || !caseId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: loading ? '#555' : '#000066',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => { if (!loading) e.target.style.background = '#000099'; }}
      onMouseLeave={(e) => { if (!loading) e.target.style.background = '#000066'; }}
    >
      {loading ? (
        <>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff4', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Generating…
        </>
      ) : (
        <>📄 Export Case Summary</>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
