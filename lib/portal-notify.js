// Helper to trigger portal notifications from anywhere in the app
// Usage: await notifyClient(caseId, 'phase_change', { new_phase: 'Litigation' })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : "http://localhost:3000";

export async function notifyClient(caseId, type, params = {}) {
  try {
    const res = await fetch(`${BASE_URL}/api/portal/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: caseId, type, ...params }),
    });
    const data = await res.json();
    if (data.skipped) {
      console.log(`Portal notification skipped for case ${caseId}: ${data.reason}`);
    }
    return data;
  } catch (err) {
    console.error(`Portal notification failed for case ${caseId}:`, err.message);
    return { error: err.message };
  }
}

// Convenience helpers
export const notifyPhaseChange = (caseId, newPhase, explanation) =>
  notifyClient(caseId, "phase_change", { new_phase: newPhase, explanation });

export const notifyDocumentUploaded = (caseId, documentName, uploadedBy) =>
  notifyClient(caseId, "document_uploaded", { document_name: documentName, uploaded_by: uploadedBy });

export const notifyTaskMilestone = (caseId, milestoneName, description) =>
  notifyClient(caseId, "task_milestone", { milestone_name: milestoneName, description });
