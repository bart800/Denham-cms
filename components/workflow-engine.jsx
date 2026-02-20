"use client";
import { useState, useEffect, useCallback } from "react";

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
  "Litigation - Filed": "⚖️",
  "Litigation - Discovery": "🔎", "Litigation - Mediation": "🤝",
  "Litigation - Trial Prep": "📑", "Appraisal": "📊",
  "Settled": "💰", "Closed": "✅",
};

export default function WorkflowEngine({ caseId, caseStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/workflow`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchWorkflow(); }, [fetchWorkflow]);

  const generateTasks = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/workflow`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      await fetchWorkflow();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const { supabase } = await import("../lib/supabase");
      await supabase.from("case_tasks").update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", task.id);
      await fetchWorkflow();
    } catch (err) {
      setError(err.message);
    }
  };

  const currentPhaseIdx = ALL_PHASES.indexOf(caseStatus);
  const phaseTasks = (data?.tasks || []).filter(t => {
    const tpl = data?.allTemplates?.[caseStatus] || [];
    return tpl.some(tmpl => tmpl.title.toLowerCase() === t.title.toLowerCase());
  });
  // Also show all tasks for current case regardless
  const allTasks = data?.tasks || [];
  const completedCount = allTasks.filter(t => t.status === "completed").length;
  const totalCount = allTasks.length;
  const today = new Date().toISOString().split("T")[0];

  const priColor = (p) => ({ urgent: B.danger, high: "#e0a050", medium: B.gold, low: B.txtM }[p] || B.txtM);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.txtM }}>Loading workflow...</div>;

  return (
    <div>
      {/* Phase Progress Bar */}
      <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 16, marginBottom: 20, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "fit-content" }}>
          {ALL_PHASES.map((phase, i) => {
            const isCurrent = phase === caseStatus;
            const isPast = i < currentPhaseIdx;
            const bg = isCurrent ? B.gold : isPast ? B.green : `${B.bdr}`;
            const txtC = isCurrent ? "#000" : isPast ? "#fff" : B.txtD;
            return (
              <div key={phase} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "6px 10px", borderRadius: 8,
                  background: isCurrent ? `${B.gold}20` : "transparent",
                  border: isCurrent ? `2px solid ${B.gold}` : "2px solid transparent",
                  minWidth: 60,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: bg, color: txtC, fontSize: 13, fontWeight: 700,
                  }}>
                    {isPast ? "✓" : PHASE_ICONS[phase] || (i + 1)}
                  </div>
                  <div style={{ fontSize: 9, color: isCurrent ? B.gold : isPast ? B.green : B.txtD, fontWeight: isCurrent ? 700 : 500, textAlign: "center", lineHeight: 1.2, maxWidth: 70 }}>
                    {phase.replace("Litigation - ", "Lit: ")}
                  </div>
                </div>
                {i < ALL_PHASES.length - 1 && (
                  <div style={{ width: 16, height: 2, background: isPast ? B.green : B.bdr, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Header with badge and generate button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: B.txt, margin: 0 }}>
            {PHASE_ICONS[caseStatus]} {caseStatus} Tasks
          </h3>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600,
            background: completedCount === totalCount && totalCount > 0 ? `${B.green}30` : `${B.gold}20`,
            color: completedCount === totalCount && totalCount > 0 ? B.green : B.gold,
            padding: "2px 10px", borderRadius: 12,
          }}>
            {completedCount}/{totalCount}
          </span>
        </div>
        <button
          onClick={generateTasks}
          disabled={generating || !data?.template?.length}
          style={{
            background: B.gold, color: "#000", border: "none", borderRadius: 8,
            padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            opacity: generating || !data?.template?.length ? 0.5 : 1,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {generating ? "Generating..." : "⚡ Generate Tasks"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", marginBottom: 16, borderRadius: 8, fontSize: 13, background: `${B.danger}15`, color: B.danger, border: `1px solid ${B.danger}30` }}>
          ❌ {error}
        </div>
      )}

      {/* No template message */}
      {!data?.template?.length && (
        <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 40, textAlign: "center", color: B.txtM, marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14 }}>No workflow template defined for <strong style={{ color: B.gold }}>{caseStatus}</strong> phase.</div>
        </div>
      )}

      {/* Task list */}
      {allTasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {allTasks.map(task => {
            const done = task.status === "completed";
            const overdue = !done && task.due_date && task.due_date < today;
            return (
              <div key={task.id} style={{
                background: B.card, border: `1px solid ${overdue ? B.danger + "60" : B.bdr}`,
                borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                opacity: done ? 0.6 : 1, transition: "all 0.15s ease",
              }}>
                <span
                  onClick={() => toggleTask(task)}
                  style={{ cursor: "pointer", fontSize: 18, flexShrink: 0, userSelect: "none" }}
                >
                  {done ? "✅" : "⬜"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: done ? B.txtD : B.txt,
                    textDecoration: done ? "line-through" : "none",
                  }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 11, color: B.txtD, marginTop: 2 }}>{task.description}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {overdue && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: B.danger, background: `${B.danger}18`, padding: "2px 8px", borderRadius: 10 }}>
                      OVERDUE
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                    background: `${priColor(task.priority)}18`, color: priColor(task.priority),
                  }}>
                    {task.priority}
                  </span>
                  {task.due_date && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                      color: overdue ? B.danger : B.txtD,
                    }}>
                      {task.due_date}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allTasks.length === 0 && data?.template?.length > 0 && (
        <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 10, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 14, color: B.txtM, marginBottom: 12 }}>
            No tasks yet for this phase. Click <strong style={{ color: B.gold }}>Generate Tasks</strong> to create {data.template.length} tasks from the workflow template.
          </div>
        </div>
      )}
    </div>
  );
}
