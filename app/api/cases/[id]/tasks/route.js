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

    // If completing a task, check dependencies first
    if (updates.status === 'completed') {
      const { data: taskToCheck } = await supabaseAdmin
        .from('case_tasks')
        .select('depends_on_tasks')
        .eq('id', taskId)
        .eq('case_id', id)
        .single();

      if (taskToCheck?.depends_on_tasks?.length) {
        const { data: depTasks } = await supabaseAdmin
          .from('case_tasks')
          .select('id, title, status')
          .in('id', taskToCheck.depends_on_tasks);

        const incomplete = (depTasks || []).filter(t => t.status !== 'completed');
        if (incomplete.length > 0) {
          return NextResponse.json({
            error: 'Dependencies not met',
            message: `Complete these tasks first: ${incomplete.map(t => t.title).join(', ')}`,
            blocked_by: incomplete,
          }, { status: 422 });
        }
      }

      if (!updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('case_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('case_id', id)
      .select('*, assigned:assigned_to(id, name, email, avatar_url), creator:created_by(id, name, email)')
      .single();

    if (error) throw error;

    // Auto-create deadlines when a task is completed
    let autoDeadlines = [];
    if (updates.status === 'completed' && data.template_id) {
      autoDeadlines = await createAutoDeadlines(id, data);
    }

    return NextResponse.json({ ...data, auto_deadlines_created: autoDeadlines });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function createAutoDeadlines(caseId, completedTask) {
  try {
    // Get the workflow template to find trigger_event
    const { data: template } = await supabaseAdmin
      .from('workflow_templates')
      .select('trigger_event')
      .eq('id', completedTask.template_id)
      .single();

    if (!template?.trigger_event) return [];

    // Get case jurisdiction
    const { data: caseData } = await supabaseAdmin
      .from('cases')
      .select('jurisdiction')
      .eq('id', caseId)
      .single();

    const jurisdiction = caseData?.jurisdiction || '';
    // Normalize: "Florida" → "FL", etc. Keep short codes as-is.
    const stateAbbrevs = {
      'florida': 'FL', 'kentucky': 'KY', 'tennessee': 'TN', 'indiana': 'IN',
      'arizona': 'AZ', 'montana': 'MT', 'ohio': 'OH', 'georgia': 'GA',
    };
    const jur = stateAbbrevs[jurisdiction?.toLowerCase()] || jurisdiction?.toUpperCase() || '';

    // Find matching deadline rules (jurisdiction-specific + ALL)
    const { data: rules } = await supabaseAdmin
      .from('deadline_rules')
      .select('*')
      .eq('trigger_event', template.trigger_event)
      .or(`jurisdiction.eq.${jur},jurisdiction.eq.ALL`);

    if (!rules?.length) return [];

    // Use task completion date as the trigger date
    const triggerDate = new Date(completedTask.completed_at || new Date());
    const created = [];

    for (const rule of rules) {
      // Skip jurisdiction-specific rules that don't match (unless ALL)
      if (rule.jurisdiction !== 'ALL' && rule.jurisdiction !== jur) continue;
      // If both a specific rule and ALL rule exist for same action, prefer specific
      if (rule.jurisdiction === 'ALL' && rules.some(r => r.jurisdiction === jur && r.trigger_event === rule.trigger_event && r.action_type === rule.action_type)) continue;

      const dueDate = new Date(triggerDate);
      dueDate.setDate(dueDate.getDate() + rule.days);

      if (rule.action_type === 'calendar_event') {
        // Create court deadline
        const { data: deadline, error } = await supabaseAdmin
          .from('court_deadlines')
          .insert({
            case_id: caseId,
            deadline_type: rule.trigger_event,
            title: rule.action_label,
            description: `Auto-created: ${rule.days} days from "${completedTask.title}" (${triggerDate.toLocaleDateString()})`,
            due_date: dueDate.toISOString(),
            jurisdiction: jur || rule.jurisdiction,
            auto_calculated: true,
            source_event: rule.trigger_event,
            source_date: triggerDate.toISOString(),
          })
          .select()
          .single();

        if (!error && deadline) created.push({ type: 'court_deadline', ...deadline });
      } else {
        // Create a follow-up task
        const { data: task, error } = await supabaseAdmin
          .from('case_tasks')
          .insert({
            case_id: caseId,
            title: rule.action_label,
            description: `Auto-created from "${completedTask.title}". ${rule.is_recurring ? `Recurring every ${rule.recur_interval_days} days.` : ''}`,
            due_date: dueDate.toISOString().slice(0, 10),
            priority: rule.action_type === 'alert' ? 'high' : 'medium',
            status: 'pending',
            phase: completedTask.phase,
            is_custom: true,
          })
          .select()
          .single();

        if (!error && task) created.push({ type: 'task', ...task });
      }
    }

    return created;
  } catch (err) {
    console.error('Auto-deadline creation error:', err);
    return [];
  }
}
