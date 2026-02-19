import { supabaseAdmin, supabase } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = supabaseAdmin || supabase;
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Fetch cases with SOL dates, join claim_details for insurer
  const { data: cases, error } = await db
    .from('cases')
    .select('id, ref, client_name, status, statute_of_limitations, attorney, claim_details(insurer, date_of_loss, cause_of_loss)')
    .not('statute_of_limitations', 'is', null)
    .order('statute_of_limitations', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = cases.map(c => {
    const solDate = new Date(c.statute_of_limitations);
    const days = Math.floor((solDate - today) / 86400000);
    const claim = Array.isArray(c.claim_details) ? c.claim_details[0] : c.claim_details;

    let sol_status;
    if (days < 0) sol_status = 'expired';
    else if (days < 30) sol_status = 'critical';
    else if (days < 90) sol_status = 'warning';
    else sol_status = 'ok';

    return {
      id: c.id,
      case_number: c.ref,
      client_name: c.client_name,
      case_status: c.status,
      sol_deadline: c.statute_of_limitations,
      days_remaining: days,
      sol_status,
      attorney: c.attorney,
      insurer: claim?.insurer || null,
      date_of_loss: claim?.date_of_loss || null,
      cause_of_loss: claim?.cause_of_loss || null,
    };
  });

  // Sort: expired first (most overdue), then by days ascending
  items.sort((a, b) => a.days_remaining - b.days_remaining);

  const counts = { expired: 0, critical: 0, warning: 0, ok: 0 };
  items.forEach(i => counts[i.sol_status]++);

  return NextResponse.json({
    items,
    counts,
    total: items.length,
    generated: new Date().toISOString(),
  });
}
