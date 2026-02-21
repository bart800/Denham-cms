// ============================================================
// Audit Logging Helper for Denham CMS
// ============================================================
// Uses the existing `audit_trail` table in Supabase

import { supabaseAdmin, supabase } from "./supabase";

const db = supabaseAdmin || supabase;

/**
 * Log an audit event
 * @param {object} params
 * @param {string} params.userId - team_member ID
 * @param {string} params.action - e.g. "update", "create", "delete", "assign", "status_change"
 * @param {string} params.entityType - e.g. "case", "task", "document", "team_member", "settings"
 * @param {string} params.entityId - ID of the entity
 * @param {object} [params.oldValues] - previous values (for updates)
 * @param {object} [params.newValues] - new values (for updates)
 * @param {string} [params.ipAddress] - request IP
 * @param {string} [params.description] - human-readable description
 */
export async function logAudit({ userId, action, entityType, entityId, oldValues, newValues, ipAddress, description }) {
  if (!db) return;
  try {
    // Build changes object that matches existing audit_trail schema
    const changes = {};
    if (oldValues) changes.old = oldValues;
    if (newValues) changes.new = newValues;
    if (description) changes.description = description;

    await db.from("audit_trail").insert({
      user_type: "staff",
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes: Object.keys(changes).length > 0 ? changes : null,
      ip_address: ipAddress || null,
    });
  } catch (err) {
    console.error("[audit] Failed to log:", err.message);
    // Don't throw — audit failures should never break the main operation
  }
}

/**
 * Extract IP from Next.js request
 */
export function getRequestIP(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}
