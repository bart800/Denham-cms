'use client';
import React from 'react';
import CaseDetailCards from './case-detail-cards';

/**
 * CaseDetailWrapper — Enhanced case detail cards for the staff portal.
 *
 * HOW TO ADD TO denham-staff-portal.jsx:
 * ──────────────────────────────────────
 * 1. Add this import at the top of denham-staff-portal.jsx:
 *
 *    import CaseDetailWrapper from './case-detail-wrapper';
 *
 * 2. In the case detail view section (where individual case info is rendered),
 *    add this component, passing the selected case:
 *
 *    <CaseDetailWrapper caseData={selectedCase} />
 *
 *    Place it right after the case header / before existing case details.
 */

export default function CaseDetailWrapper({ caseData }) {
  if (!caseData) return null;
  return <CaseDetailCards caseData={caseData} />;
}

export { CaseDetailWrapper };
