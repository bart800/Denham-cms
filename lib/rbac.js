// ============================================================
// RBAC — Role-Based Access Control for Denham CMS
// ============================================================
// Roles come from team_members.role: Attorney, Paralegal, Admin, Front Desk

const ROLE_PERMISSIONS = {
  Attorney: {
    // Full access
    viewDashboard: true,
    viewFinancials: true,
    viewKPIs: true,
    viewRevenue: true,
    viewCases: true,
    editCases: true,
    deleteCases: true,
    createCases: true,
    viewTasks: true,
    editTasks: true,
    viewDocuments: true,
    editDocuments: true,
    viewContacts: true,
    editContacts: true,
    viewCalendar: true,
    editCalendar: true,
    viewReports: true,
    viewSettings: true,
    editSettings: true,
    manageTeam: true,
    viewAuditLog: true,
    viewWorkflow: true,
    editWorkflow: true,
    viewNegotiations: true,
    editNegotiations: true,
    viewBilling: true,
    editBilling: true,
    changeFeePercentages: true,
    viewStrategy: true,
    viewCompareCases: true,
    viewTemplates: true,
    editTemplates: true,
    viewCounselIntel: true,
    viewEmailFiling: true,
    viewCompliance: true,
    viewIntake: true,
    editIntake: true,
    logCalls: true,
    viewActivity: true,
  },
  Admin: {
    // Same as Attorney — full access
    viewDashboard: true,
    viewFinancials: true,
    viewKPIs: true,
    viewRevenue: true,
    viewCases: true,
    editCases: true,
    deleteCases: true,
    createCases: true,
    viewTasks: true,
    editTasks: true,
    viewDocuments: true,
    editDocuments: true,
    viewContacts: true,
    editContacts: true,
    viewCalendar: true,
    editCalendar: true,
    viewReports: true,
    viewSettings: true,
    editSettings: true,
    manageTeam: true,
    viewAuditLog: true,
    viewWorkflow: true,
    editWorkflow: true,
    viewNegotiations: true,
    editNegotiations: true,
    viewBilling: true,
    editBilling: true,
    changeFeePercentages: true,
    viewStrategy: true,
    viewCompareCases: true,
    viewTemplates: true,
    editTemplates: true,
    viewCounselIntel: true,
    viewEmailFiling: true,
    viewCompliance: true,
    viewIntake: true,
    editIntake: true,
    logCalls: true,
    viewActivity: true,
  },
  Paralegal: {
    viewDashboard: true,
    viewFinancials: false,
    viewKPIs: true,        // can see KPIs but not revenue numbers
    viewRevenue: false,
    viewCases: true,
    editCases: true,
    deleteCases: false,
    createCases: true,
    viewTasks: true,
    editTasks: true,
    viewDocuments: true,
    editDocuments: true,
    viewContacts: true,
    editContacts: true,
    viewCalendar: true,
    editCalendar: true,
    viewReports: true,     // non-financial reports
    viewSettings: false,
    editSettings: false,
    manageTeam: false,
    viewAuditLog: false,
    viewWorkflow: true,
    editWorkflow: true,
    viewNegotiations: true,
    editNegotiations: true,
    viewBilling: false,
    editBilling: false,
    changeFeePercentages: false,
    viewStrategy: true,
    viewCompareCases: true,
    viewTemplates: true,
    editTemplates: true,
    viewCounselIntel: true,
    viewEmailFiling: true,
    viewCompliance: true,
    viewIntake: true,
    editIntake: true,
    logCalls: true,
    viewActivity: true,
  },
  "Front Desk": {
    viewDashboard: true,   // limited dashboard (no financials)
    viewFinancials: false,
    viewKPIs: false,
    viewRevenue: false,
    viewCases: true,       // read-only
    editCases: false,
    deleteCases: false,
    createCases: false,
    viewTasks: true,       // own tasks only
    editTasks: false,
    viewDocuments: true,   // read-only
    editDocuments: false,
    viewContacts: true,
    editContacts: true,    // can manage contacts
    viewCalendar: true,
    editCalendar: false,
    viewReports: false,
    viewSettings: false,
    editSettings: false,
    manageTeam: false,
    viewAuditLog: false,
    viewWorkflow: false,
    editWorkflow: false,
    viewNegotiations: false,
    editNegotiations: false,
    viewBilling: false,
    editBilling: false,
    changeFeePercentages: false,
    viewStrategy: false,
    viewCompareCases: false,
    viewTemplates: false,
    editTemplates: false,
    viewCounselIntel: false,
    viewEmailFiling: false,
    viewCompliance: false,
    viewIntake: true,      // intake form
    editIntake: true,
    logCalls: true,        // can log calls
    viewActivity: true,
  },
};

// Default fallback (minimal access)
const DEFAULT_PERMISSIONS = {
  viewDashboard: true,
  viewCases: true,
  viewTasks: true,
  viewDocuments: true,
  viewContacts: true,
  viewCalendar: true,
  viewActivity: true,
};

/**
 * Get permissions for a role
 * @param {string} role - team_members.role value
 * @returns {object} permission map
 */
export function getPermissions(role) {
  if (!role) return { ...DEFAULT_PERMISSIONS };
  // Normalize: match known roles
  const normalized = Object.keys(ROLE_PERMISSIONS).find(
    k => k.toLowerCase() === role.toLowerCase()
  );
  if (normalized) return { ...ROLE_PERMISSIONS[normalized] };
  // Unknown role gets default
  return { ...DEFAULT_PERMISSIONS };
}

/**
 * Check if a role has a specific permission
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  const perms = getPermissions(role);
  return !!perms[permission];
}

/**
 * Check if role is admin-level (Attorney or Admin)
 * @param {string} role
 * @returns {boolean}
 */
export function isAdminRole(role) {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "attorney" || r === "admin";
}

/**
 * Nav items filtered by role
 * @param {string} role
 * @returns {string[]} array of nav IDs to show
 */
export function getVisibleNavItems(role) {
  const perms = getPermissions(role);
  const items = ["dashboard", "cases"];

  if (perms.viewKPIs) items.push("kpis");
  items.push("tasks");
  items.push("calendar");
  items.push("docs");
  if (perms.viewReports) items.push("reports");
  if (perms.viewCompareCases) items.push("compare");
  if (perms.createCases || perms.viewIntake) items.push("Presuit");
  if (perms.viewTemplates) items.push("templates");
  items.push("contacts");
  if (perms.viewActivity) items.push("activity");
  if (perms.viewSettings) items.push("settings");
  if (perms.viewCounselIntel) items.push("counsel");
  if (perms.viewEmailFiling) items.push("emailFiling");
  if (perms.viewCompliance) items.push("compliance");

  return items;
}

// Export for use in API routes (server-side)
export { ROLE_PERMISSIONS };
