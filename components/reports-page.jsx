import { useState, useEffect, useMemo } from 'react';

const NAVY = '#000066';
const GOLD = '#ebb003';
const GREEN = '#386f4a';
const DARK_BG = '#0a0a1a';
const CARD_BG = '#111133';
const BORDER = '#222255';
const TEXT = '#e0e0e0';
const TEXT_MUTED = '#999';

const TABS = [
  { id: 'volume', label: 'Case Volume' },
  { id: 'pipeline', label: 'Status Pipeline' },
  { id: 'attorneys', label: 'Attorney Performance' },
  { id: 'insurers', label: 'Insurer Analysis' },
  { id: 'sol', label: 'SOL Calendar' },
  { id: 'financial', label: 'Financial Summary' },
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

function CaseVolumeReport({ cases }) {
  const months = useMemo(() => {
    const now = new Date();
    const buckets = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      buckets[key] = 0;
    }
    (cases || []).forEach(c => {
      const opened = c.open_date || c.created_at;
      if (!opened) return;
      const key = opened.slice(0, 7);
      if (key in buckets) buckets[key]++;
    });
    return Object.entries(buckets).map(([k, v]) => ({ month: k, count: v }));
  }, [cases]);

  const max = Math.max(1, ...months.map(m => m.count));

  return (
    <Card title="Cases Opened by Month (Last 12 Months)">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 220 }}>
        {months.map(m => (
          <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: TEXT, marginBottom: 4 }}>{m.count}</span>
            <div style={{
              width: '100%', maxWidth: 48,
              height: `${(m.count / max) * 180}px`,
              background: `linear-gradient(to top, ${NAVY}, ${GOLD})`,
              borderRadius: '4px 4px 0 0',
              minHeight: m.count > 0 ? 8 : 2,
            }} />
            <span style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4, whiteSpace: 'nowrap' }}>
              {m.month.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatusPipeline({ cases }) {
  const stages = useMemo(() => {
    const counts = {};
    (cases || []).forEach(c => {
      const s = c.status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [cases]);

  const max = Math.max(1, ...stages.map(s => s[1]));

  return (
    <Card title="Status Pipeline">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stages.map(([status, count]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 140, fontSize: 13, color: TEXT, textAlign: 'right', flexShrink: 0 }}>{status}</span>
            <div style={{ flex: 1, background: '#1a1a3a', borderRadius: 4, height: 28, position: 'relative' }}>
              <div style={{
                width: `${(count / max) * 100}%`,
                height: '100%',
                background: `linear-gradient(to right, ${NAVY}, ${GREEN})`,
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
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

function AttorneyPerformance({ cases }) {
  const rows = useMemo(() => {
    const map = {};
    (cases || []).forEach(c => {
      const atty = c.assigned_attorney || c.attorney || 'Unassigned';
      if (!map[atty]) map[atty] = { active: 0, settled: 0, totalRecovery: 0, wins: 0, total: 0 };
      const m = map[atty];
      m.total++;
      const settled = (c.status || '').toLowerCase().includes('settled') || (c.status || '').toLowerCase().includes('closed');
      if (settled) {
        m.settled++;
        const amt = parseFloat(c.settlement_amount || c.recovery_amount || 0);
        m.totalRecovery += amt;
        if (amt > 0) m.wins++;
      } else {
        m.active++;
      }
    });
    return Object.entries(map).map(([name, d]) => ({
      name, ...d,
      avgRecovery: d.settled > 0 ? d.totalRecovery / d.settled : 0,
      winRate: d.total > 0 ? d.wins / d.total : 0,
    })).sort((a, b) => b.totalRecovery - a.totalRecovery);
  }, [cases]);

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
              <th style={{ ...thStyle, textAlign: 'right' }}>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.active}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.totalRecovery)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.avgRecovery)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(r.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InsurerAnalysis({ cases }) {
  const rows = useMemo(() => {
    const map = {};
    (cases || []).forEach(c => {
      const ins = c.insurance_company || c.insurer || 'Unknown';
      if (!map[ins]) map[ins] = { cases: 0, settled: 0, totalSettlement: 0, litigation: 0 };
      const m = map[ins];
      m.cases++;
      const status = (c.status || '').toLowerCase();
      if (status.includes('settled') || status.includes('closed')) {
        m.settled++;
        m.totalSettlement += parseFloat(c.settlement_amount || c.recovery_amount || 0);
      }
      if (status.includes('litigat')) m.litigation++;
    });
    return Object.entries(map).map(([name, d]) => ({
      name, ...d,
      avgSettlement: d.settled > 0 ? d.totalSettlement / d.settled : 0,
    })).sort((a, b) => b.cases - a.cases);
  }, [cases]);

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
              <th style={{ ...thStyle, textAlign: 'right' }}>Avg Settlement</th>
              <th style={{ ...thStyle, textAlign: 'right' }}># in Litigation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.cases}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.settled}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(r.avgSettlement)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.litigation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SOLCalendar({ cases }) {
  const deadlines = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 90);
    return (cases || [])
      .filter(c => c.sol_date || c.statute_of_limitations)
      .map(c => ({ ...c, solDate: new Date(c.sol_date || c.statute_of_limitations) }))
      .filter(c => c.solDate >= now && c.solDate <= end)
      .sort((a, b) => a.solDate - b.solDate);
  }, [cases]);

  const getDaysLeft = (d) => Math.ceil((d - new Date()) / 86400000);

  return (
    <Card title="SOL Deadlines — Next 90 Days">
      {deadlines.length === 0 ? (
        <p style={{ color: TEXT_MUTED }}>No SOL deadlines in the next 90 days.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {deadlines.map((c, i) => {
            const days = getDaysLeft(c.solDate);
            const urgent = days <= 14;
            const warning = days <= 30;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: urgent ? '#440000' : warning ? '#332200' : '#1a1a3a',
                borderLeft: `4px solid ${urgent ? '#ff4444' : warning ? GOLD : GREEN}`,
                borderRadius: 4,
              }}>
                <span style={{ width: 90, fontSize: 13, color: urgent ? '#ff6666' : TEXT, fontWeight: 600 }}>
                  {c.solDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span style={{ fontSize: 12, color: urgent ? '#ff8888' : GOLD, width: 70, textAlign: 'center' }}>
                  {days}d left
                </span>
                <span style={{ flex: 1, fontSize: 13, color: TEXT }}>
                  {c.client_name || c.case_name || c.name || `Case #${c.id}`}
                </span>
                <span style={{ fontSize: 12, color: TEXT_MUTED }}>{c.case_type || ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function FinancialSummary({ cases }) {
  const data = useMemo(() => {
    let totalRecovery = 0;
    let totalFees = 0;
    const byMonth = {};
    const settlements = [];

    (cases || []).forEach(c => {
      const amt = parseFloat(c.settlement_amount || c.recovery_amount || 0);
      const fee = parseFloat(c.fee_amount || 0);
      if (amt > 0) {
        totalRecovery += amt;
        totalFees += fee;
        settlements.push({ name: c.client_name || c.case_name || c.name || `Case #${c.id}`, amount: amt });
        const settled = c.settlement_date || c.closed_date || c.updated_at || '';
        if (settled) {
          const key = settled.slice(0, 7);
          byMonth[key] = (byMonth[key] || 0) + amt;
        }
      }
    });

    settlements.sort((a, b) => b.amount - a.amount);
    const monthEntries = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));

    return { totalRecovery, totalFees, top10: settlements.slice(0, 10), monthEntries };
  }, [cases]);

  const maxMonth = Math.max(1, ...data.monthEntries.map(m => m[1]));

  return (
    <>
      <Card title="Financial Overview">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Recovery', value: fmt$(data.totalRecovery), color: GREEN },
            { label: 'Total Fees', value: fmt$(data.totalFees), color: GOLD },
            { label: 'Top Settlements', value: data.top10.length, color: NAVY },
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 200px', padding: 20, background: '#1a1a3a', borderRadius: 8,
              borderTop: `3px solid ${s.color}`, textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: TEXT }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Recovery by Month">
        {data.monthEntries.length === 0 ? (
          <p style={{ color: TEXT_MUTED }}>No recovery data available.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200 }}>
            {data.monthEntries.map(([m, v]) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: TEXT, marginBottom: 4 }}>{fmt$(v)}</span>
                <div style={{
                  width: '100%', maxWidth: 48,
                  height: `${(v / maxMonth) * 160}px`,
                  background: `linear-gradient(to top, ${GREEN}, ${GOLD})`,
                  borderRadius: '4px 4px 0 0', minHeight: 4,
                }} />
                <span style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4 }}>{m.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Top 10 Settlements">
        {data.top10.map((s, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: i < 9 ? `1px solid ${BORDER}` : 'none',
          }}>
            <span style={{ fontSize: 13, color: TEXT }}>
              <span style={{ color: GOLD, marginRight: 8 }}>#{i + 1}</span>{s.name}
            </span>
            <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>{fmt$(s.amount)}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('volume');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const cases = data?.cases || data?.data || [];

  return (
    <div style={{ background: DARK_BG, minHeight: '100vh', color: TEXT, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 28, color: GOLD }}>📊 Reports & Analytics</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', borderBottom: `2px solid ${BORDER}`, paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
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

        {loading && <p style={{ color: TEXT_MUTED, textAlign: 'center', padding: 40 }}>Loading reports...</p>}
        {error && <p style={{ color: '#ff4444', textAlign: 'center', padding: 40 }}>Error: {error}</p>}

        {!loading && !error && (
          <>
            {activeTab === 'volume' && <CaseVolumeReport cases={cases} />}
            {activeTab === 'pipeline' && <StatusPipeline cases={cases} />}
            {activeTab === 'attorneys' && <AttorneyPerformance cases={cases} />}
            {activeTab === 'insurers' && <InsurerAnalysis cases={cases} />}
            {activeTab === 'sol' && <SOLCalendar cases={cases} />}
            {activeTab === 'financial' && <FinancialSummary cases={cases} />}
          </>
        )}
      </div>
    </div>
  );
}
