'use client';
import { useState, useEffect, Fragment } from 'react';

const styles = {
  container: { padding: '20px', fontFamily: 'system-ui, sans-serif', color: '#e0e0e0' },
  title: { color: '#ebb003', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#000044' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #ebb003', color: '#ebb003', fontSize: '13px', fontWeight: 600 },
  td: { padding: '10px 12px', borderBottom: '1px solid #000066', fontSize: '14px' },
  row: { cursor: 'pointer', transition: 'background 0.15s' },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    background: color, color: '#fff'
  }),
  expandedRow: { background: '#000033', padding: '12px 20px' },
  metric: { display: 'inline-block', marginRight: '20px', fontSize: '13px' },
  metricLabel: { color: '#999', marginRight: '4px' },
  empty: { padding: '40px', textAlign: 'center', color: '#666' },
  loading: { padding: '40px', textAlign: 'center', color: '#ebb003' },
};

const categoryColors = { incoming: '#386f4a', missed: '#cc3333', voicemail: '#b8860b', outgoing: '#2255aa' };

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CaseCalls({ caseId }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!caseId) return;
    fetch(`/api/cases/${caseId}/calls`)
      .then(r => r.json())
      .then(data => { setCalls(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [caseId]);

  if (loading) return <div style={styles.loading}>Loading calls...</div>;
  if (!calls.length) return <div style={styles.empty}>No calls found for this case.</div>;

  return (
    <div style={styles.container}>
      <div style={styles.title}>📞 Call Log ({calls.length})</div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Dir</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Caller</th>
            <th style={styles.th}>Number</th>
            <th style={styles.th}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => {
            const isExpanded = expanded === c.id;
            const hasAI = c.ai_talk_pct || c.ai_listen_pct || c.ai_silent_pct;
            const mainCat = (c.category || '').split(',')[0].trim().toLowerCase();
            return (
              <Fragment key={c.id}>
                <tr
                  style={{ ...styles.row, background: isExpanded ? '#000033' : 'transparent' }}
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  onMouseEnter={e => e.currentTarget.style.background = '#000055'}
                  onMouseLeave={e => e.currentTarget.style.background = isExpanded ? '#000033' : 'transparent'}
                >
                  <td style={styles.td}>{c.direction === 'inbound' ? '📞' : '📱'}</td>
                  <td style={styles.td}>
                    <span style={styles.badge(categoryColors[mainCat] || '#555')}>{mainCat || c.category}</span>
                  </td>
                  <td style={styles.td}>{c.date_started ? new Date(c.date_started).toLocaleString() : '--'}</td>
                  <td style={styles.td}>{c.caller_name || '--'}</td>
                  <td style={styles.td}>{c.external_number || '--'}</td>
                  <td style={styles.td}>{formatDuration(c.duration_seconds)}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} style={styles.expandedRow}>
                      <div>
                        <span style={styles.metric}><span style={styles.metricLabel}>Target:</span> {c.target_name || '--'} ({c.target_type || '--'})</span>
                        <span style={styles.metric}><span style={styles.metricLabel}>Talk:</span> {formatDuration(c.talk_duration_seconds)}</span>
                        <span style={styles.metric}><span style={styles.metricLabel}>Recorded:</span> {c.was_recorded ? '✅' : '❌'}</span>
                        <span style={styles.metric}><span style={styles.metricLabel}>Voicemail:</span> {c.voicemail ? '✅' : '❌'}</span>
                      </div>
                      {hasAI && (
                        <div style={{ marginTop: '8px' }}>
                          <span style={styles.metric}><span style={styles.metricLabel}>AI Talk:</span> {c.ai_talk_pct ?? '--'}%</span>
                          <span style={styles.metric}><span style={styles.metricLabel}>AI Listen:</span> {c.ai_listen_pct ?? '--'}%</span>
                          <span style={styles.metric}><span style={styles.metricLabel}>AI Silent:</span> {c.ai_silent_pct ?? '--'}%</span>
                        </div>
                      )}
                      {c.notes && <div style={{ marginTop: '8px', color: '#aaa' }}>{c.notes}</div>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

