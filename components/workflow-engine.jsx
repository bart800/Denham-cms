"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
  danger: "#e04050",
};

const ALL_PHASES = [
  "Presuit", "Presuit Demand",
  "Litigation - Filed", "Litigation - Discovery", "Litigation - Mediation",
  "Litigation - Trial Prep", "Appraisal", "Settled", "Closed",
];

const PHASE_ICONS = {
  "Presuit": "📋", "Presuit Demand": "📨",
  "Litigation - Filed": "⚖️", "Litigation - Discovery": "🔎",
  "Litigation - Mediation": "🤝", "Litigation - Trial Prep": "📑",
  "Appraisal": "📊", "Settled": "💰", "Closed": "✅",
};

const ROLE_COLORS = {
  "Attorney": { bg: "#000066", text: "#7788ff" },
  "Paralegal": { bg: "#386f4a20", text: "#5dba7d" },
  "Front Desk": { bg: "#ebb00320", text: "#ebb003" },
};

export default function WorkflowEngine({ caseId, caseStatus, caseType }) {
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [deadlineRules, setDeadlineRules] = useState([]);
  const [docTemplates, setDocTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activePhase, setActivePhase] = useState(caseStatus || "Presuit");
  const [showAllPhases, setShowAllPhases] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  // Determine if PI case
  const isPI = useMemo(() => {
    if (!caseType) return false;
    const t = caseType.toLowerCase();
    return t.includes("pi") || t.includes("personal injury") || t === "mva";
  }, [caseType]);

  const effectiveCaseType = isPI ? "pi" : "property";

  // Fetch workflow tasks for this case
  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/workflow`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setTasks(json.tasks || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // Fetch templates for reference
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflow-templates?case_type=${effectiveCaseType}`);
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates || json || []);
      }
    } catch {}
  }, [effectiveCaseType]);

  // Fetch deadline rules
  const fetchDeadlineRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/deadline-rules`);
      if (res.ok) {
        const json = await res.json();
        setDeadlineRules(json.rules || json || []);
      }
    } catch {}
  }, []);

  // Fetch document templates
  const fetchDocTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/document-templates`);
      if (res.ok) {
        const json = await res.json();
        setDocTemplates(json.templates || json || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchWorkflow();
    fetchTemplates();
    fetchDeadlineRules();
    fetchDocTemplates();
  }, [fetchWorkflow, fetchTemplates, fetchDeadlineRules, fetchDocTemplates]);

  // Generate/instantiate tasks from templates
  const generateTasks = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_type: effectiveCaseType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setSuccess("Tasks generated from SOP templates!");
      setTimeout(() => setSuccess(null), 3000);
      await fetchWorkflow();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle task completion
  const toggleTask = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const { supabase } = await import("../lib/supabase");
      await supabase.from("case_tasks").update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", task.id);
      // Update local state immediately
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null } : t
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped = {};
    ALL_PHASES.forEach(p => { grouped[p] = []; });
    tasks.forEach(t => {
      const phase = t.phase || t.workflow_phase || caseStatus;
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(t);
    });
    // Sort within each phase by task_order
    Object.keys(grouped).forEach(p => {
      grouped[p].sort((a, b) => (a.task_order || 0) - (b.task_order || 0));
    });
    return grouped;
  }, [tasks, caseStatus]);

  // Templates grouped by phase for reference
  const templatesByPhase = useMemo(() => {
    const grouped = {};
    (Array.isArray(templates) ? templates : []).forEach(t => {
      if (!grouped[t.phase]) grouped[t.phase] = [];
      grouped[t.phase].push(t);
    });
    return grouped;
  }, [templates]);

  // Phase stats
  const phaseStats = useMemo(() => {
    const stats = {};
    ALL_PHASES.forEach(p => {
      const phaseTasks = tasksByPhase[p] || [];
      stats[p] = {
        total: phaseTasks.length,
        completed: phaseTasks.filter(t => t.status === "completed").length,
        gates: phaseTasks.filter(t => t.is_gate),
        gatesComplete: phaseTasks.filter(t => t.is_gate && t.status === "completed").length,
      };
    });
    return stats;
  }, [tasksByPhase]);

  const currentPhaseIdx = ALL_PHASES.indexOf(caseStatus);
  const activePhaseIdx = ALL_PHASES.indexOf(activePhase);
  const activeTasks = tasksByPhase[activePhase] || [];
  const activeCompleted = activeTasks.filter(t => t.status === "completed").length;
  const activeTotal = activeTasks.length;
  const today = new Date().toISOString().split("T")[0];

  // Find document templates linked to a task
  const getLinkedDocs = (taskTitle) => {
    return docTemplates.filter(dt => dt.linked_task_title && taskTitle.toLowerCase().includes(dt.linked_task_title.toLowerCase()));
  };

  // Check document gates for current phase
  const gateWarnings = useMemo(() => {
    const warnings = [];
    const phaseTasks = tasksByPhase[caseStatus] || [];
    phaseTasks.forEach(t => {
      if (t.is_gate && t.status !== "completed") {
        warnings.push(t.title);
      }
    });
    return warnings;
  }, [tasksByPhase, caseStatus]);

  // "What's next" — first incomplete non-blocked task
  const whatsNext = useMemo(() => {
    return activeTasks.find(t => t.status !== "completed");
  }, [activeTasks]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading workflow...</div>;

  return (
    <div>
      {/* Phase Progress Bar */}
      <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 16, marginBottom: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "fit-content" }}>
          {ALL_PHASES.map((phase, i) => {
            const isCurrent = phase === caseStatus;
            const isActive = phase === activePhase;
            const isPast = i < currentPhaseIdx;
            const stats = phaseStats[phase];
            const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const bg = isCurrent ? B.gold : isPast ? B.green : B.bdr;
            const txtC = isCurrent ? "#000" : isPast ? "#fff" : B.txtD;
            return (
              <div key={phase} style={{ display: "flex", alignItems: "center" }}>
                <div
                  onClick={() => setActivePhase(phase)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                    background: isActive ? `${B.gold}15` : "transparent",
                    border: isActive ? `2px solid ${B.gold}` : isCurrent ? `2px solid ${B.gold}40` : "2px solid transparent",
                    minWidth: 68, transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: bg, color: txtC, fontSize: 13, fontWeight: 700,
                  }}>
                    {isPast && pct === 100 ? "✓" : PHASE_ICONS[phase] || (i + 1)}
                  </div>
                  <div style={{ fontSize: 9, color: isActive ? B.gold : isCurrent ? B.gold : isPast ? B.green : B.txtD, fontWeight: isActive || isCurrent ? 700 : 500, textAlign: "center", lineHeight: 1.2, maxWidth: 75 }}>
                    {phase.replace("Litigation - ", "")}
                  </div>
                  {stats.total > 0 && (
                    <div style={{ width: 40, height: 3, borderRadius: 2, background: B.bdr, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? B.green : B.gold, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  )}
                </div>
                {i < ALL_PHASES.length - 1 && (
                  <div style={{ width: 12, height: 2, background: isPast ? B.green : B.bdr, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gate Warnings */}
      {gateWarnings.length > 0 && activePhase === caseStatus && (
        <div style={{
          background: `${B.danger}10`, border: `1px solid ${B.danger}30`, borderRadius: 8,
          padding: "10px 14px", marginBottom: 16, fontSize: 12,
        }}>
          <div style={{ color: B.danger, fontWeight: 700, marginBottom: 4 }}>🚪 Phase Gate — Complete before advancing:</div>
          {gateWarnings.map((w, i) => (
            <div key={i} style={{ color: B.danger, opacity: 0.8, paddingLeft: 16 }}>• {w}</div>
          ))}
        </div>
      )}

      {/* What's Next */}
      {whatsNext && activePhase === caseStatus && (
        <div style={{
          background: `${B.gold}08`, border: `1px solid ${B.gold}25`, borderRadius: 8,
          padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>👉</span>
          <div>
            <div style={{ fontSize: 11, color: B.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>What's Next</div>
            <div style={{ fontSize: 13, color: B.txt }}>{whatsNext.title}</div>
            {whatsNext.description && <div style={{ fontSize: 11, color: B.txtM, marginTop: 2 }}>{whatsNext.description}</div>}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: B.txt, margin: 0 }}>
            {PHASE_ICONS[activePhase]} {activePhase}
          </h3>
          {activeTotal > 0 && (
            <span style={{
              fontFamily: "monospace", fontSize: 12, fontWeight: 600,
              background: activeCompleted === activeTotal ? `${B.green}30` : `${B.gold}20`,
              color: activeCompleted === activeTotal ? B.green : B.gold,
              padding: "2px 10px", borderRadius: 12,
            }}>
              {activeCompleted}/{activeTotal}
            </span>
          )}
          {isPI && (
            <span style={{ fontSize: 10, background: `${B.navy}40`, color: "#7788ff", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>PI</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {activeTotal === 0 && (
            <button
              onClick={generateTasks}
              disabled={generating}
              style={{
                background: B.gold, color: "#000", border: "none", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                opacity: generating ? 0.5 : 1,
              }}
            >
              {generating ? "Generating..." : "⚡ Generate from SOPs"}
            </button>
          )}
        </div>
      </div>

      {/* Success/Error messages */}
      {success && (
        <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 8, fontSize: 12, background: `${B.green}15`, color: B.green, border: `1px solid ${B.green}30` }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 8, fontSize: 12, background: `${B.danger}15`, color: B.danger, border: `1px solid ${B.danger}30` }}>
          ❌ {error}
        </div>
      )}

      {/* Task list */}
      {activeTotal > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {activeTasks.map((task, idx) => {
            const done = task.status === "completed";
            const overdue = !done && task.due_date && task.due_date < today;
            const isGate = task.is_gate;
            const expanded = expandedTask === task.id;
            const linkedDocs = getLinkedDocs(task.title);
            const role = task.role || "Paralegal";
            const rc = ROLE_COLORS[role] || ROLE_COLORS["Paralegal"];

            return (
              <div key={task.id} style={{
                background: B.card,
                border: `1px solid ${isGate && !done ? B.gold + "40" : overdue ? B.danger + "50" : B.bdr}`,
                borderRadius: 8, overflow: "hidden",
                opacity: done ? 0.55 : 1, transition: "all 0.15s ease",
              }}>
                <div style={{
                  padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer",
                }} onClick={() => setExpandedTask(expanded ? null : task.id)}>
                  {/* Checkbox */}
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                    style={{ cursor: "pointer", fontSize: 16, flexShrink: 0, userSelect: "none" }}
                  >
                    {done ? "✅" : "⬜"}
                  </span>

                  {/* Order number */}
                  <span style={{ fontSize: 10, color: B.txtD, fontFamily: "monospace", minWidth: 18, textAlign: "center" }}>
                    {task.task_order || idx + 1}
                  </span>

                  {/* Title + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: done ? B.txtD : B.txt,
                      textDecoration: done ? "line-through" : "none",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {task.title}
                      {isGate && <span style={{ fontSize: 9, background: `${B.gold}20`, color: B.gold, padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>GATE</span>}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    {overdue && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: B.danger, background: `${B.danger}18`, padding: "2px 6px", borderRadius: 8 }}>OVERDUE</span>
                    )}
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 8, background: rc.bg, color: rc.text }}>
                      {role}
                    </span>
                    {task.due_date && (
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: overdue ? B.danger : B.txtD }}>
                        {task.due_date}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: B.txtD, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div style={{ padding: "0 14px 12px 52px", borderTop: `1px solid ${B.bdr}` }}>
                    {task.description && (
                      <div style={{ fontSize: 12, color: B.txtM, marginTop: 8, lineHeight: 1.5 }}>{task.description}</div>
                    )}
                    {task.sop_reference && (
                      <div style={{ fontSize: 11, color: B.txtD, marginTop: 6 }}>
                        📖 <em>{task.sop_reference}</em>
                      </div>
                    )}
                    {task.required_docs && task.required_docs.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: B.txtD, fontWeight: 600, marginBottom: 4 }}>REQUIRED DOCS:</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {task.required_docs.map((doc, i) => (
                            <span key={i} style={{ fontSize: 10, background: B.bdr, color: B.txtM, padding: "2px 8px", borderRadius: 6 }}>{doc}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {linkedDocs.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: B.txtD, fontWeight: 600, marginBottom: 4 }}>📄 LINKED TEMPLATES:</div>
                        {linkedDocs.map((dt, i) => (
                          <div key={i} style={{ fontSize: 11, color: B.txtM, marginBottom: 2 }}>
                            • {dt.name} {dt.state && <span style={{ fontSize: 9, color: B.gold }}>({dt.state})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {done && task.completed_at && (
                      <div style={{ fontSize: 10, color: B.green, marginTop: 8 }}>
                        ✅ Completed {new Date(task.completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 13, color: B.txtM, marginBottom: 12 }}>
            No tasks for <strong style={{ color: B.gold }}>{activePhase}</strong>.
            {activePhase === caseStatus ? " Click Generate to create tasks from SOP templates." : " Tasks will appear when the case reaches this phase."}
          </div>
          {activePhase === caseStatus && (
            <button
              onClick={generateTasks}
              disabled={generating}
              style={{
                background: B.gold, color: "#000", border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                opacity: generating ? 0.5 : 1,
              }}
            >
              {generating ? "Generating..." : "⚡ Generate from SOPs"}
            </button>
          )}
        </div>
      )}

      {/* Overall progress summary */}
      {tasks.length > 0 && (
        <div style={{
          background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10,
          padding: 14, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 12, color: B.txtM }}>
            Overall: <strong style={{ color: B.txt }}>{tasks.filter(t => t.status === "completed").length}</strong> / {tasks.length} tasks complete
          </div>
          <div style={{ width: 120, height: 6, background: B.bdr, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100) : 0}%`,
              height: "100%", background: B.green, borderRadius: 4, transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
