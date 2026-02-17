import { supabaseAdmin } from '../../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigned_to = searchParams.get('assigned_to');

    let query = supabaseAdmin
      .from('case_tasks')
      .select('*, assigned:assigned_to(id, name, email, avatar_url), creator:created_by(id, name, email)')
      .eq('case_id', id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('case_tasks')
      .insert({ ...body, case_id: id })
      .select('*, assigned:assigned_to(id, name, email, avatar_url), creator:created_by(id, name, email)')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { taskId, ...updates } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('case_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('case_id', id)
      .select('*, assigned:assigned_to(id, name, email, avatar_url), creator:created_by(id, name, email)')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
