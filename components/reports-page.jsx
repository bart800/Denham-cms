import { useState, useCallback } from 'react';

const NAVY = '#000066';
const GOLD = '#ebb003';
const GREEN = '#386f4a';
const DARK_BG = '#0a0a1a';
const CARD_BG = '#111133';
const BORDER = '#222255';
const TEXT = '#e0e0e0';
const TEXT_MUTED = '#999';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'attorneys', label: 'Attorneys' },
  { id: 'insurers', label: 'Insurers' },
  { id: 'financial', label: 'Financial' },
  { id: 'sol', label: 'SOL Tracker' },
  { id: 'aging', label: 'Aging' },
  { id: 'volume', label: 'Volume' },
  { id: 'monthly_performance', label: 'Monthly Perf' },
  { id: 'insurer_response', label: 'Insurer Response' },
  { id: 'attorney_productivity', label: 'Atty Productivity' },
  { id: 'case_aging_detail', label: 'Case Aging Detail' },
];

function fmt$(n) {
  if (n == null) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n) {
  if (n == null) return '0%';
  return (Number(n) * 100).toFixed(1) + '%';
}

function Card({ title, children }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, marginBottom: 20 }}>
      {title && <h3 style={{ margin: '0 0 16px', color: GOLD, fontSize: 18 }}>{title}</h3>}
      {children}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 200px', padding: 20, background: '#1a1a3a', borderRadius: 8,
      borderTop: `3px solid ${color || GOLD}`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: TEXT }}>{value}</div>
    </div>
  );
}

function Loading() {
  return <p style={{ color: TEXT_MUTED, textAlign: 'center', padding: 40 }}>Loading report data...</p>;
}

/* ===== Tab Components ===== */

function SummaryTab({ data }) {
  return (
    <>
      <Card title="Overview">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatBox label="Total Cases" value={data.total} color={NAVY} />
          <StatBox label="Active" value={data.active} color={GREEN} />
          <StatBox label="Settled" value={data.settled} color={GOLD} />
          <StatBox label="In Litigation" value={data.inLitigation} color="#6b6bff" />
        </div>
      </Card>
      <Card title="Financial">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatBox label="Total Recovery" value={fmt$(data.totalRecovery)} color={GREEN} />
          <StatBox label="Total Fees" value={fmt$(data.totalFees)} color={GOLD} />
          <StatBox label="Opened This Month" value={data.openedThisMonth} color={NAVY} />
          <StatBox label="SOL in 30 Days" value={data.solUrgent30} color="#ff4444" />
        </div>
      </Card>
      {data.byType && (
        <Card title="Cases by Type">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const max = Math.max(...Object.values(data.byType));
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 160, fontSize: 13, color: TEXT, textAlign: 'right', flexShrink: 0 }}>{type}</span>
                  <div style={{ flex: 1, background: '#1a1a3a', borderRadius: 4, height: 28, position: 'relative' }}>
                    <div style={{
                      width: `${(count / max) * 100}%`, height: '100%',
                      background: `linear-gradient(to right, ${NAVY}, ${GOLD})`,
                      borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                    }}>
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

function PipelineTab({ data }) {
  const max = Math.max(1, ...data.pipeline.map(s => s.count));
  return (
    <Card title={`Status Pipeline (${data.total} cases)`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.pipeline.map(({ status, count }) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 140, fontSize: 13, color: TEXT, textAlign: 'right', flexShrink: 0 }}>{status}</span>
            <div style={{ flex: 1, background: '#1a1a3a', borderRadius: 4, height: 28, position: 'relative' }}>
              <div style={{
                width: `${(count / max) * 100}%`, height: '100%',
                background: `linear-gradient(to right, ${NAVY}, ${GREEN})`,
                borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
              }}>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AttorneysTab({ data }) {
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 };
  const tdStyle = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT };
  return (
    <Card title="Attorney Performance">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Attorney</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Active</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Settled</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total Recovery</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Avg Recovery</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Settle Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.attorneys.map(r => (
              <tr key={r.name}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.active}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.totalRecovery)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.avgRecovery)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(r.settleRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InsurersTab({ data }) {
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 };
  const tdStyle = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT };
  return (
    <Card title="Insurer Analysis">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Insurer</th>
              <th style={{ ...thStyle, textAlign: 'right' }}># Cases</th>
              <th style={{ ...thStyle, textAlign: 'right' }}># Settled</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Avg Recovery</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Litigation Rate</th>
              <th style={{ ...thStyle, textAlign: 'right' }}># Litigation</th>
            </tr>
          </thead>
          <tbody>
            {data.insurers.map(r => (
              <tr key={r.name}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.total}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.avgRecovery)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(r.litigationRate)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.litigation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FinancialTab({ data }) {
  const monthEntries = Object.entries(data.byMonth || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonth = Math.max(1, ...monthEntries.map(([, m]) => m.recovery));
  return (
    <>
      <Card title="Financial Overview">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatBox label="Total Recovery" value={fmt$(data.totalRecovery)} color={GREEN} />
          <StatBox label="Total Fees" value={fmt$(data.totalFees)} color={GOLD} />
          <StatBox label="Avg Recovery" value={fmt$(data.avgRecovery)} color={NAVY} />
          <StatBox label="Settled Cases" value={data.settledCount} color={GREEN} />
        </div>
      </Card>
      <Card title="Recovery by Month">
        {monthEntries.length === 0 ? (
          <p style={{ color: TEXT_MUTED }}>No recovery data available.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200 }}>
            {monthEntries.map(([m, v]) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: TEXT, marginBottom: 4 }}>{fmt$(v.recovery)}</span>
                <div style={{
                  width: '100%', maxWidth: 48,
                  height: `${(v.recovery / maxMonth) * 160}px`,
                  background: `linear-gradient(to top, ${GREEN}, ${GOLD})`,
                  borderRadius: '4px 4px 0 0', minHeight: 4,
                }} />
                <span style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4 }}>{m.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Top Settlements">
        {(data.topSettlements || []).slice(0, 10).map((s, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: i < 9 ? `1px solid ${BORDER}` : 'none',
          }}>
            <span style={{ fontSize: 13, color: TEXT }}>
              <span style={{ color: GOLD, marginRight: 8 }}>#{i + 1}</span>
              {s.client_name || s.ref}
              {s.insurer && <span style={{ color: TEXT_MUTED, marginLeft: 8, fontSize: 11 }}>({s.insurer})</span>}
            </span>
            <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>{fmt$(s.total_recovery)}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function SOLTab({ data }) {
  return (
    <>
      <Card title="SOL Overview">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatBox label="Critical (≤14 days)" value={data.critical} color="#ff4444" />
          <StatBox label="High (≤30 days)" value={data.high} color={GOLD} />
          <StatBox label="Total Upcoming" value={data.total} color={NAVY} />
        </div>
      </Card>
      <Card title="SOL Deadlines">
        {data.deadlines.length === 0 ? (
          <p style={{ color: TEXT_MUTED }}>No upcoming SOL deadlines.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.deadlines.map((d, i) => {
              const urgent = d.urgency === 'critical';
              const warning = d.urgency === 'high';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: urgent ? '#440000' : warning ? '#332200' : '#1a1a3a',
                  borderLeft: `4px solid ${urgent ? '#ff4444' : warning ? GOLD : GREEN}`,
                  borderRadius: 4,
                }}>
                  <span style={{ width: 90, fontSize: 13, color: urgent ? '#ff6666' : TEXT, fontWeight: 600 }}>
                    {new Date(d.sol_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 12, color: urgent ? '#ff8888' : GOLD, width: 70, textAlign: 'center' }}>
                    {d.daysLeft}d left
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: TEXT }}>
                    {d.client_name || d.ref}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>{d.attorney || ''}</span>
                  <span style={{ fontSize: 11, color: TEXT_MUTED }}>{d.type || ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function AgingTab({ data }) {
  const bucketColors = { '0-30': GREEN, '31-90': GOLD, '91-180': '#e0a050', '181-365': '#e07040', '365+': '#ff4444' };
  const maxBucket = Math.max(1, ...Object.values(data.buckets));
  return (
    <>
      <Card title="Case Aging Overview">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatBox label="Active Cases" value={data.totalActive} color={NAVY} />
          <StatBox label="Avg Days Open" value={data.avgDaysOpen} color={GOLD} />
        </div>
      </Card>
      <Card title="Age Distribution (Active Cases)">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 220 }}>
          {Object.entries(data.buckets).map(([bucket, count]) => (
            <div key={bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: TEXT, marginBottom: 6, fontWeight: 600 }}>{count}</span>
              <div style={{
                width: '100%', maxWidth: 80,
                height: `${(count / maxBucket) * 160}px`,
                background: bucketColors[bucket] || GOLD,
                borderRadius: '6px 6px 0 0', minHeight: count > 0 ? 12 : 4, opacity: 0.85,
              }} />
              <span style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>{bucket} days</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Avg Days by Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.avgByStatus.map(({ status, avgDays, count }) => {
            const maxAvg = Math.max(1, ...data.avgByStatus.map(s => s.avgDays));
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 160, fontSize: 13, color: TEXT, textAlign: 'right', flexShrink: 0 }}>{status}</span>
                <div style={{ flex: 1, background: '#1a1a3a', borderRadius: 4, height: 28, position: 'relative' }}>
                  <div style={{
                    width: `${(avgDays / maxAvg) * 100}%`, height: '100%',
                    background: avgDays > 365 ? '#ff4444' : avgDays > 180 ? '#e07040' : `linear-gradient(to right, ${NAVY}, ${GOLD})`,
                    borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                  }}>
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{avgDays}d</span>
                  </div>
                </div>
                <span style={{ width: 50, fontSize: 11, color: TEXT_MUTED, textAlign: 'right' }}>({count})</span>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Oldest Active Cases">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Client', 'Ref', 'Status', 'Attorney', 'Days Open'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Days Open' ? 'right' : 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.oldest.map((c, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT }}>{c.client_name}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT_MUTED }}>{c.ref}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT }}>{c.status}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT }}>{c.attorney || '—'}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: c.daysOpen > 365 ? '#ff4444' : c.daysOpen > 180 ? '#e07040' : TEXT, textAlign: 'right', fontWeight: 600 }}>{c.daysOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function VolumeTab({ data }) {
  const months = data.months || [];
  const max = Math.max(1, ...months.map(m => m.opened));
  // Collect all case types across months
  const allTypes = [...new Set(months.flatMap(m => Object.keys(m.byType || {})))];
  const typeColors = ['#ebb003', '#386f4a', '#6b6bff', '#e07040', '#ff4444', '#40c0c0', '#c060c0', '#8888ff'];

  return (
    <>
      <Card title="Cases Opened by Month (Last 12 Months)">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 220 }}>
          {months.map(m => (
            <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: TEXT, marginBottom: 4 }}>{m.opened}</span>
              <div style={{
                width: '100%', maxWidth: 48,
                height: `${(m.opened / max) * 180}px`,
                background: `linear-gradient(to top, ${NAVY}, ${GOLD})`,
                borderRadius: '4px 4px 0 0',
                minHeight: m.opened > 0 ? 8 : 2,
              }} />
              <span style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4, whiteSpace: 'nowrap' }}>
                {m.month.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Volume by Case Type">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {allTypes.map((t, i) => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: TEXT_MUTED }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: typeColors[i % typeColors.length], display: 'inline-block' }} />
              {t}
            </span>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 12 }}>Month</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 12 }}>Total</th>
                {allTypes.map(t => (
                  <th key={t} style={{ padding: '8px 10px', textAlign: 'right', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 12 }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month}>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT }}>{m.month}</td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, textAlign: 'right', fontWeight: 600 }}>{m.opened}</td>
                  {allTypes.map(t => (
                    <td key={t} style={{ padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT_MUTED, textAlign: 'right' }}>{(m.byType || {})[t] || 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ===== CSV Export Helper ===== */
function exportCSV(headers, rows, filename) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ===== New Tab Components ===== */

function MonthlyPerformanceTab({ data }) {
  const rows = data.rows || [];
  const maxRecovery = Math.max(1, ...rows.map(r => r.totalRecovery));
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 };
  const tdStyle = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT };
  return (
    <>
      <Card title="Monthly Firm Performance">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatBox label="Cases Opened" value={data.totals?.opened || 0} color={NAVY} />
          <StatBox label="Cases Settled" value={data.totals?.settled || 0} color={GREEN} />
          <StatBox label="Total Recovery" value={fmt$(data.totals?.totalRecovery)} color={GOLD} />
        </div>
        <button onClick={() => exportCSV(
          ['Month', 'Opened', 'Settled', 'Total Recovery', 'Avg Days to Settle'],
          rows.map(r => [r.month, r.opened, r.settled, r.totalRecovery, r.avgDaysToSettle ?? '']),
          'monthly-performance.csv'
        )} style={{ padding: '6px 14px', background: NAVY, color: GOLD, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          ⬇ Export CSV
        </button>
      </Card>
      <Card title="Recovery by Month">
        {rows.length === 0 ? <p style={{ color: TEXT_MUTED }}>No data.</p> : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200, marginBottom: 16 }}>
            {rows.map(r => (
              <div key={r.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: TEXT, marginBottom: 4 }}>{fmt$(r.totalRecovery)}</span>
                <div style={{ width: '100%', maxWidth: 48, height: `${(r.totalRecovery / maxRecovery) * 160}px`, background: `linear-gradient(to top, ${GREEN}, ${GOLD})`, borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                <span style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4 }}>{r.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Monthly Detail">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Month</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Opened</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Settled</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Recovery</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Avg Days</th>
            </tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.month}>
                <td style={tdStyle}>{r.month}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.opened}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.totalRecovery)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.avgDaysToSettle ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function InsurerResponseTab({ data }) {
  const rows = data.rows || [];
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 };
  const tdStyle = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT };
  const maxDays = Math.max(1, ...rows.filter(r => r.avgResponseDays != null).map(r => r.avgResponseDays));
  return (
    <>
      <Card title="Insurer Response Time">
        <button onClick={() => exportCSV(
          ['Insurer', 'Cases', 'Avg Response Days', 'Settled', 'Avg Recovery'],
          rows.map(r => [r.name, r.cases, r.avgResponseDays ?? '', r.settled, r.avgRecovery]),
          'insurer-response.csv'
        )} style={{ padding: '6px 14px', background: NAVY, color: GOLD, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          ⬇ Export CSV
        </button>
        {rows.filter(r => r.avgResponseDays != null).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {rows.filter(r => r.avgResponseDays != null).slice(0, 15).map(r => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 180, fontSize: 13, color: TEXT, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <div style={{ flex: 1, background: '#1a1a3a', borderRadius: 4, height: 28, position: 'relative' }}>
                  <div style={{ width: `${(r.avgResponseDays / maxDays) * 100}%`, height: '100%', background: r.avgResponseDays > 60 ? '#ff4444' : r.avgResponseDays > 30 ? '#e07040' : GREEN, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{r.avgResponseDays}d</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Insurer</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Cases</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Avg Response Days</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Settled</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Avg Recovery</th>
            </tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.name}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.cases}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: r.avgResponseDays > 60 ? '#ff4444' : r.avgResponseDays > 30 ? '#e07040' : TEXT }}>{r.avgResponseDays ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.avgRecovery)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function AttorneyProductivityTab({ data }) {
  const rows = data.rows || [];
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 };
  const tdStyle = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT };
  return (
    <Card title="Attorney Productivity">
      <button onClick={() => exportCSV(
        ['Attorney', 'Cases', 'Active', 'Settled', 'Recovery', 'Fees', 'Avg Recovery', 'Avg Days', 'Tasks Done', 'Tasks Total', 'Settle Rate'],
        rows.map(r => [r.name, r.cases, r.active, r.settled, r.totalRecovery, r.totalFees, r.avgRecovery, r.avgDaysToSettle ?? '', r.tasksCompleted, r.tasksTotal, (r.settleRate * 100).toFixed(1) + '%']),
        'attorney-productivity.csv'
      )} style={{ padding: '6px 14px', background: NAVY, color: GOLD, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
        ⬇ Export CSV
      </button>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thStyle}>Attorney</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cases</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Active</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Settled</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Recovery</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Recovery</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Days</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Tasks ✓</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Settle %</th>
          </tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.name}>
              <td style={tdStyle}>{r.name}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.cases}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.active}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.totalRecovery)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.avgRecovery)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.avgDaysToSettle ?? '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.tasksCompleted}/{r.tasksTotal}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(r.settleRate)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function CaseAgingDetailTab({ data }) {
  const bucketLabels = ['0-30', '31-90', '91-180', '181-365', '365+'];
  const bucketColors = { '0-30': GREEN, '31-90': GOLD, '91-180': '#e0a050', '181-365': '#e07040', '365+': '#ff4444' };
  const maxBucket = Math.max(1, ...Object.values(data.bucketCounts || {}));
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${GOLD}`, color: GOLD, fontSize: 13 };
  const tdStyle = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT };
  return (
    <>
      <Card title={`Case Aging by Bucket (${data.totalActive} active)`}>
        <button onClick={() => {
          const ct = data.crossTab || [];
          exportCSV(
            ['Phase', ...bucketLabels, 'Total'],
            ct.map(r => [r.phase, ...bucketLabels.map(b => r[b] || 0), r.total]),
            'case-aging-detail.csv'
          );
        }} style={{ padding: '6px 14px', background: NAVY, color: GOLD, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          ⬇ Export CSV
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 220, marginBottom: 20 }}>
          {bucketLabels.map(b => {
            const count = (data.bucketCounts || {})[b] || 0;
            return (
              <div key={b} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: TEXT, marginBottom: 6, fontWeight: 600 }}>{count}</span>
                <div style={{ width: '100%', maxWidth: 80, height: `${(count / maxBucket) * 160}px`, background: bucketColors[b], borderRadius: '6px 6px 0 0', minHeight: count > 0 ? 12 : 4, opacity: 0.85 }} />
                <span style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>{b} days</span>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Phase × Age Bucket (Cross-Tab)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Phase</th>
              {bucketLabels.map(b => <th key={b} style={{ ...thStyle, textAlign: 'right' }}>{b}</th>)}
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            </tr></thead>
            <tbody>{(data.crossTab || []).map(r => (
              <tr key={r.phase}>
                <td style={tdStyle}>{r.phase}</td>
                {bucketLabels.map(b => <td key={b} style={{ ...tdStyle, textAlign: 'right', color: b === '365+' && r[b] > 0 ? '#ff4444' : TEXT }}>{r[b] || 0}</td>)}
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.total}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Case Details (Top 50 oldest)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Client', 'Ref', 'Phase', 'Insurer', 'Attorney', 'Bucket', 'Days'].map(h => (
                <th key={h} style={{ ...thStyle, textAlign: h === 'Days' ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{(data.cases || []).map((c, i) => (
              <tr key={i}>
                <td style={tdStyle}>{c.client_name}</td>
                <td style={{ ...tdStyle, color: TEXT_MUTED }}>{c.ref}</td>
                <td style={tdStyle}>{c.status}</td>
                <td style={tdStyle}>{c.insurer || '—'}</td>
                <td style={tdStyle}>{c.attorney || '—'}</td>
                <td style={{ ...tdStyle, color: bucketColors[c.bucket] || TEXT }}>{c.bucket}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: c.daysOpen > 365 ? '#ff4444' : c.daysOpen > 180 ? '#e07040' : TEXT }}>{c.daysOpen}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const TAB_COMPONENTS = {
  summary: SummaryTab,
  pipeline: PipelineTab,
  attorneys: AttorneysTab,
  insurers: InsurersTab,
  financial: FinancialTab,
  sol: SOLTab,
  aging: AgingTab,
  volume: VolumeTab,
  monthly_performance: MonthlyPerformanceTab,
  insurer_response: InsurerResponseTab,
  attorney_productivity: AttorneyProductivityTab,
  case_aging_detail: CaseAgingDetailTab,
};

const DATE_RANGE_TABS = ['monthly_performance', 'insurer_response', 'attorney_productivity', 'case_aging_detail'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchTab = useCallback(async (tabId, from, to) => {
    const cacheKey = `${tabId}|${from || ''}|${to || ''}`;
    if (cache[cacheKey]) { setCache(prev => ({ ...prev, [tabId]: prev[cacheKey] })); return; }
    if (loading[tabId]) return;
    setLoading(prev => ({ ...prev, [tabId]: true }));
    setErrors(prev => ({ ...prev, [tabId]: null }));
    try {
      const params = new URLSearchParams({ type: tabId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const resp = await fetch(`/api/reports?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setCache(prev => ({ ...prev, [tabId]: data, [cacheKey]: data }));
    } catch (e) {
      setErrors(prev => ({ ...prev, [tabId]: e.message }));
    }
    setLoading(prev => ({ ...prev, [tabId]: false }));
  }, [cache, loading]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    fetchTab(tabId, DATE_RANGE_TABS.includes(tabId) ? dateFrom : '', DATE_RANGE_TABS.includes(tabId) ? dateTo : '');
  };

  const handleDateApply = () => {
    setCache(prev => { const n = { ...prev }; delete n[activeTab]; return n; });
    fetchTab(activeTab, dateFrom, dateTo);
  };

  // Fetch initial tab
  if (!cache[activeTab] && !loading[activeTab] && !errors[activeTab]) {
    fetchTab(activeTab, DATE_RANGE_TABS.includes(activeTab) ? dateFrom : '', DATE_RANGE_TABS.includes(activeTab) ? dateTo : '');
  }

  const TabComponent = TAB_COMPONENTS[activeTab];
  const tabData = cache[activeTab];
  const tabLoading = loading[activeTab];
  const tabError = errors[activeTab];

  return (
    <div style={{ background: DARK_BG, minHeight: '100vh', color: TEXT, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 28, color: GOLD }}>📊 Reports & Analytics</h1>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', borderBottom: `2px solid ${BORDER}`, paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)} style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === t.id ? NAVY : 'transparent',
              color: activeTab === t.id ? GOLD : TEXT_MUTED,
              border: 'none', borderBottom: activeTab === t.id ? `2px solid ${GOLD}` : '2px solid transparent',
              borderRadius: '6px 6px 0 0', transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {DATE_RANGE_TABS.includes(activeTab) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>Date Range:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: '#1a1a3a', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '6px 10px', color: TEXT, fontSize: 13 }} />
            <span style={{ color: TEXT_MUTED }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ background: '#1a1a3a', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '6px 10px', color: TEXT, fontSize: 13 }} />
            <button onClick={handleDateApply}
              style={{ padding: '6px 14px', background: GOLD, color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Apply
            </button>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(handleDateApply, 0); }}
                style={{ padding: '6px 14px', background: 'transparent', color: TEXT_MUTED, border: `1px solid ${BORDER}`, borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                Clear
              </button>
            )}
          </div>
        )}

        {tabLoading && <Loading />}
        {tabError && <p style={{ color: '#ff4444', textAlign: 'center', padding: 40 }}>Error: {tabError}</p>}
        {!tabLoading && !tabError && tabData && TabComponent && <TabComponent data={tabData} />}
      </div>
    </div>
  );
}
