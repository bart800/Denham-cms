'use client';
import { useState, useEffect, useCallback } from 'react';

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#ebb003', low: '#6b7280' };
const STATUS_COLORS = { pending: '#6b7280', in_progress: '#3b82f6', completed: '#386f4a', cancelled: '#991b1b' };
const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };

const styles = {
  container: { background: '#111', borderRadius: 8, padding: 20, color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 700, color: '#ebb003', margin: 0 },
  btn: { background: '#000066', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnSmall: { background: 'transparent', border: '1px solid #333', color: '#ccc', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  taskRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, marginBottom: 6, background: '#1a1a1a', cursor: 'pointer', transition: 'background 0.15s' },
  checkbox: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: '#000066', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 },
  form: { background: '#1a1a1a', borderRadius: 8, padding: 16, marginTop: 12 },
  input: { background: '#222', border: '1px solid #333', color: '#e5e5e5', borderRadius: 6, padding: '8px 12px', width: '100%', fontSize: 13, boxSizing: 'border-box' },
  select: { background: '#222', border: '1px solid #333', color: '#e5e5e5', borderRadius: 6, padding: '8px 12px', fontSize: 13 },
  label: { fontSize: 12, color: '#999', marginBottom: 4, display: 'block' },
  overdue: { color: '#ef4444', fontSize: 12, fontWeight: 600 },
  dueDate: { fontSize: 12, color: '#888' },
  filters: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  empty: { textAlign: 'center', padding: 32, color: '#666' },
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CaseTasks({ caseId, teamMembers = [], currentUserId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState({ status: '', priority: '', assigned_to: '' });
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.priority) params.set('priority', filter.priority);
    if (filter.assigned_to) params.set('assigned_to', filter.assigned_to);
    const qs = params.toString();
    const res = await fetch(`/api/cases/${caseId}/tasks${qs ? '?' + qs : ''}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [caseId, filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.assigned_to) delete payload.assigned_to;
    if (!payload.due_date) delete payload.due_date;
    if (currentUserId) payload.created_by = currentUserId;
    const res = await fetch(`/api/cases/${caseId}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (res.ok) {
      setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });
      setShowForm(false);
      fetchTasks();
    }
  };

  const toggleComplete = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, status: newStatus }),
    });
    fetchTasks();
  };

  const updateStatus = async (taskId, status) => {
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    fetchTasks();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Tasks ({tasks.length})</h3>
        <button style={styles.btn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Task'}
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select style={styles.select} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={styles.select} value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priority</option>
          {Object.keys(PRIORITY_COLORS).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select style={styles.select} value={filter.assigned_to} onChange={e => setFilter(f => ({ ...f, assigned_to: e.target.value }))}>
          <option value="">All Assignees</option>
          {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Add Task Form */}
      {showForm && (
        <form style={styles.form} onSubmit={createTask}>
          <div style={{ marginBottom: 10 }}>
            <label style={styles.label}>Title *</label>
            <input style={styles.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Task title..." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={styles.label}>Description</label>
            <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={styles.label}>Priority</label>
              <select style={{ ...styles.select, width: '100%' }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {Object.keys(PRIORITY_COLORS).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={styles.label}>Due Date</label>
              <input style={styles.input} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={styles.label}>Assign To</label>
              <select style={{ ...styles.select, width: '100%' }} value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Unassigned</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" style={styles.btn}>Create Task</button>
        </form>
      )}

      {/* Task List */}
      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : tasks.length === 0 ? (
        <div style={styles.empty}>No tasks yet</div>
      ) : (
        tasks.map(task => {
          const overdue = isOverdue(task.due_date, task.status);
          const done = task.status === 'completed';
          return (
            <div key={task.id} style={{ ...styles.taskRow, opacity: done ? 0.6 : 1 }}>
              {/* Checkbox */}
              <div
                style={{ ...styles.checkbox, borderColor: done ? '#386f4a' : '#444', background: done ? '#386f4a' : 'transparent' }}
                onClick={() => toggleComplete(task)}
              >
                {done && '✓'}
              </div>

              {/* Priority dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[task.priority], flexShrink: 0 }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, textDecoration: done ? 'line-through' : 'none', color: done ? '#888' : '#e5e5e5' }}>
                  {task.title}
                </div>
                {task.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>}
              </div>

              {/* Due date */}
              {task.due_date && (
                <span style={overdue ? styles.overdue : styles.dueDate}>
                  {overdue && '⚠ '}{formatDate(task.due_date)}
                </span>
              )}

              {/* Status badge */}
              <span style={{ ...styles.badge, background: STATUS_COLORS[task.status] + '22', color: STATUS_COLORS[task.status] }}>
                {STATUS_LABELS[task.status]}
              </span>

              {/* Status dropdown */}
              <select
                style={{ ...styles.select, padding: '2px 4px', fontSize: 11, background: 'transparent', border: 'none', color: '#888' }}
                value={task.status}
                onChange={e => updateStatus(task.id, e.target.value)}
                onClick={e => e.stopPropagation()}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>

              {/* Assignee avatar */}
              {task.assigned?.name ? (
                <div style={styles.avatar} title={task.assigned.name}>
                  {task.assigned.avatar_url
                    ? <img src={task.assigned.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    : getInitials(task.assigned.name)}
                </div>
              ) : (
                <div style={{ ...styles.avatar, background: '#333' }} title="Unassigned">—</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
