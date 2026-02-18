import { supabaseAdmin, supabase } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = supabaseAdmin || supabase;
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const { data, error } = await db
    .from('cases')
    .select('id, client_name, ref, statute_of_limitations, status')
    .not('status', 'in', '("Settled","Closed")')
    .not('statute_of_limitations', 'is', null)
    .lte('statute_of_limitations', in90)
    .order('statute_of_limitations', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const expired = [], critical = [], warning = [], upcoming = [];

  for (const row of data) {
    const days = Math.floor((new Date(row.statute_of_limitations) - new Date(today)) / 86400000);
    const entry = { ...row, days_remaining: days };
    if (days < 0) expired.push(entry);
    else if (days <= 14) critical.push(entry);
    else if (days <= 30) warning.push(entry);
    else upcoming.push(entry);
  }

  return NextResponse.json({
    expired, critical, warning, upcoming,
    summary: {
      expired: expired.length,
      critical: critical.length,
      warning: warning.length,
      upcoming: upcoming.length,
      total: data.length
    },
    generated: new Date().toISOString()
  });
}
