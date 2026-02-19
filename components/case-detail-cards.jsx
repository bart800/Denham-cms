'use client';
import React, { useMemo } from 'react';

const COLORS = {
  navy: '#000066',
  gold: '#ebb003',
  green: '#386f4a',
  cardBg: '#0a0a2e',
  cardBorder: '#1a1a4e',
  text: '#e0e0e0',
  textMuted: '#8888aa',
  white: '#ffffff',
  red: '#cc3333',
  orange: '#e67e22',
};

const causeEmoji = {
  fire: '🔥', water: '💧', wind: '🌬️', hail: '🧊', hurricane: '🌀',
  flood: '💧', lightning: '⚡', theft: '🔒', vandalism: '🚨',
  mold: '🦠', smoke: '💨', collapse: '🏚️', sinkhole: '🕳️',
};

const getCauseEmoji = (cause) => {
  if (!cause) return '📋';
  const lower = cause.toLowerCase();
  for (const [key, emoji] of Object.entries(causeEmoji)) {
    if (lower.includes(key)) return emoji;
  }
  return '📋';
};

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
};

const formatCurrency = (v) => {
  if (v == null || v === '') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v));
};

const daysUntil = (d) => {
  if (!d) return null;
  const diff = (new Date(d) - new Date()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
};

const cardStyle = {
  background: COLORS.cardBg,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: '12px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const labelStyle = { fontSize: '11px', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 };
const valueStyle = { fontSize: '14px', color: COLORS.white, margin: '2px 0 0 0', fontWeight: 500 };
const headerStyle = { fontSize: '16px', fontWeight: 700, color: COLORS.gold, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' };

const Field = ({ label, value }) => (
  <div>
    <p style={labelStyle}>{label}</p>
    <p style={valueStyle}>{value || '—'}</p>
  </div>
);

const CardHeader = ({ icon, title }) => (
  <div style={{ borderBottom: `1px solid ${COLORS.cardBorder}`, paddingBottom: '10px', marginBottom: '4px' }}>
    <h3 style={headerStyle}>{icon} {title}</h3>
  </div>
);

// 1. Property Info Card
const PropertyInfoCard = ({ caseData }) => {
  const cd = caseData.cd || caseData.claim_details || {};
  return (
    <div style={cardStyle}>
      <CardHeader icon={getCauseEmoji(cd.causeOfLoss || caseData.cause_of_loss)} title="Property Info" />
      <Field label="Address" value={cd.propAddr || caseData.property_address} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Cause of Loss" value={cd.causeOfLoss || caseData.cause_of_loss} />
        <Field label="Date of Loss" value={formatDate(cd.dateOfLoss || caseData.date_of_loss || caseData.dol)} />
      </div>
      <Field label="Type" value={caseData.type} />
    </div>
  );
};

// 2. Insurance Card
const InsuranceCard = ({ caseData }) => {
  const raw = caseData.claim_details || {};
  const cd = caseData.cd || {};
  const insurer = cd.insurer || raw.insurer || caseData.insurer;
  const claimNum = cd.claimNumber || raw.claim_number || caseData.cn;
  const policyNum = cd.policyNumber || raw.policy_number || caseData.pn;
  const adjName = cd.adjuster || raw.adjuster_name;
  const adjPhone = cd.adjPhone || raw.adjuster_phone;
  const adjEmail = cd.adjEmail || raw.adjuster_email;
  const dateDenied = cd.dateDenied || raw.date_denied;
  const dateReported = cd.dateReported || raw.date_reported;
  const coverages = [
    ['Dwelling', cd.coverageDwelling || raw.coverage_dwelling],
    ['Other Structure', cd.coverageOtherStructure || raw.coverage_other_structure],
    ['Contents', cd.coverageContents || raw.coverage_contents],
    ['ALE', cd.coverageAle || raw.coverage_ale],
  ].filter(([, v]) => v);

  return (
    <div style={cardStyle}>
      <CardHeader icon="🛡️" title="Insurance" />
      <Field label="Insurer" value={insurer} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Claim #" value={claimNum} />
        <Field label="Policy #" value={policyNum} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {dateReported && <Field label="Date Reported" value={formatDate(dateReported)} />}
        {dateDenied && <Field label="Date Denied" value={formatDate(dateDenied)} />}
      </div>
      {coverages.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '10px', marginTop: '4px' }}>
            <p style={{ ...labelStyle, marginBottom: '6px' }}>Coverage Limits</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {coverages.map(([label, val], i) => (
              <Field key={i} label={label} value={formatCurrency(val)} />
            ))}
          </div>
        </>
      )}
      {(adjName || adjPhone || adjEmail) && (
        <>
          <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '10px', marginTop: '4px' }}>
            <p style={{ ...labelStyle, marginBottom: '6px' }}>Adjuster</p>
          </div>
          <Field label="Name" value={adjName} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone" value={adjPhone} />
            <Field label="Email" value={adjEmail} />
          </div>
        </>
      )}
    </div>
  );
};

// 3. Financial Card
const FinancialCard = ({ caseData }) => (
  <div style={cardStyle}>
    <CardHeader icon="💰" title="Financials" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <div>
        <p style={labelStyle}>Total Recovery</p>
        <p style={{ ...valueStyle, fontSize: '20px', color: COLORS.green, fontWeight: 700 }}>
          {formatCurrency(caseData.total_recovery || caseData.totalRec)}
        </p>
      </div>
      <div>
        <p style={labelStyle}>Attorney Fees</p>
        <p style={{ ...valueStyle, fontSize: '20px', color: COLORS.gold, fontWeight: 700 }}>
          {formatCurrency(caseData.attorney_fees || caseData.attFees)}
        </p>
      </div>
    </div>
    {caseData.estimated_value && <Field label="Estimated Value" value={formatCurrency(caseData.estimated_value)} />}
  </div>
);

// 4. Timeline Card
const TimelineCard = ({ caseData }) => {
  const raw = caseData.claim_details || {};
  const cd = caseData.cd || {};
  const events = useMemo(() => {
    const e = [];
    const dol = cd.dateOfLoss || caseData.date_of_loss || caseData.dol;
    const reported = cd.dateReported || raw.date_reported;
    const denied = cd.dateDenied || raw.date_denied;
    const opened = caseData.date_opened || caseData.dop;
    const sol = caseData.statute_of_limitations || caseData.sol;
    if (dol) e.push({ label: 'Date of Loss', date: dol, color: COLORS.red });
    if (reported) e.push({ label: 'Claim Reported', date: reported, color: COLORS.gold });
    if (denied) e.push({ label: 'Claim Denied', date: denied, color: '#cc3333' });
    if (opened) e.push({ label: 'Case Opened', date: opened, color: COLORS.gold });
    if (sol) e.push({ label: 'SOL Deadline', date: sol, color: COLORS.orange });
    return e.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [caseData]);

  return (
    <div style={cardStyle}>
      <CardHeader icon="📅" title="Timeline" />
      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        {events.length === 0 && <p style={{ color: COLORS.textMuted, fontSize: '13px' }}>No dates available</p>}
        {events.map((ev, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: i < events.length - 1 ? '20px' : 0, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '-20px', top: '4px',
              width: '12px', height: '12px', borderRadius: '50%',
              background: ev.color, border: `2px solid ${COLORS.cardBg}`, zIndex: 1,
            }} />
            {i < events.length - 1 && (
              <div style={{ position: 'absolute', left: '-15px', top: '16px', width: '2px', height: 'calc(100% + 8px)', background: COLORS.cardBorder }} />
            )}
            <div>
              <p style={labelStyle}>{ev.label}</p>
              <p style={{ ...valueStyle, color: ev.color }}>{formatDate(ev.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. Status Card
const StatusCard = ({ caseData }) => {
  const solDays = daysUntil(caseData.statute_of_limitations || caseData.sol);
  const statusColor = caseData.status === 'Closed' ? COLORS.textMuted
    : caseData.status === 'Active' ? COLORS.green : COLORS.gold;
  const solColor = solDays === null ? COLORS.textMuted : solDays <= 30 ? COLORS.red : solDays <= 90 ? COLORS.orange : COLORS.green;

  return (
    <div style={cardStyle}>
      <CardHeader icon="📊" title="Status" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
          background: `${statusColor}22`, border: `1px solid ${statusColor}`,
          color: statusColor, fontSize: '13px', fontWeight: 600,
        }}>
          {caseData.status || 'Unknown'}
        </span>
      </div>
      {(caseData.statute_of_limitations || caseData.sol) && (
        <div style={{ marginTop: '8px' }}>
          <p style={labelStyle}>Statute of Limitations</p>
          <p style={{ ...valueStyle, color: solColor, fontSize: '18px', fontWeight: 700 }}>
            {solDays !== null ? (solDays > 0 ? `${solDays} days remaining` : 'EXPIRED') : '—'}
          </p>
          <p style={{ ...valueStyle, fontSize: '12px', color: COLORS.textMuted }}>{formatDate(caseData.statute_of_limitations || caseData.sol)}</p>
        </div>
      )}
    </div>
  );
};

// Main export
export default function CaseDetailCards({ caseData }) {
  if (!caseData) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    }}>
      <PropertyInfoCard caseData={caseData} />
      <InsuranceCard caseData={caseData} />
      <FinancialCard caseData={caseData} />
      <StatusCard caseData={caseData} />
      <TimelineCard caseData={caseData} />
    </div>
  );
}

export { CaseDetailCards, PropertyInfoCard, InsuranceCard, FinancialCard, TimelineCard, StatusCard };
