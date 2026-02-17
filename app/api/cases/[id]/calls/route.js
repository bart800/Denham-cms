import { supabaseAdmin, supabase } from '../../../../../lib/supabase.js';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;

  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await db
    .from('case_calls')
    .select('*')
    .eq('case_id', id)
    .order('date_started', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
