/**
 * Frontend RBAC permission matrix — mirrors backend/auth.py ROLE_PERMISSIONS.
 * Keep both in sync; the backend is the enforcement authority, this file only
 * controls what the UI shows/enables per role (Three Lines of Defense).
 */

export type RoleId = "investigator" | "manager" | "administrator";

export type Permission =
  // Case decisions
  | "case.view"
  | "case.decide_flag"
  | "case.decide_dismiss"
  | "case.decide_escalate"
  | "case.decide_block"
  | "case.update"
  // Insider alert lifecycle
  | "insider.claim"
  | "insider.escalate"
  | "insider.dismiss"
  | "insider.resolve"
  | "insider.reopen"
  | "insider.view"
  // Users & admin
  | "users.view"
  | "users.create"
  | "users.status"
  // Reports
  | "reports.view"
  | "reports.draft"
  | "reports.submit"
  // Audit
  | "audit.view_self"
  | "audit.view_all"
  // Settings
  | "settings.manage";

export const ROLE_PERMISSIONS: Record<RoleId, ReadonlySet<Permission>> = {
  investigator: new Set<Permission>([
    "case.view",
    "case.decide_flag",
    "case.decide_dismiss",
    "case.decide_escalate",
    "insider.claim",
    "insider.escalate",
    "reports.view",
    "reports.draft",
    "audit.view_self",
  ]),
  manager: new Set<Permission>([
    "case.view",
    "case.decide_flag",
    "case.decide_dismiss",
    "case.decide_escalate",
    "case.decide_block", // sole authority to freeze accounts (2nd Line)
    "case.update",
    "insider.claim",
    "insider.escalate",
    "insider.dismiss",
    "insider.resolve",
    "insider.reopen",
    "users.view",
    "reports.view",
    "reports.draft",
    "reports.submit",
    "audit.view_self",
    "audit.view_all",
  ]),
  administrator: new Set<Permission>([
    "case.view", // view-only: zero case-decision authority
    "insider.view",
    "users.view",
    "users.create",
    "users.status",
    "reports.view",
    "audit.view_self",
    "audit.view_all",
    "settings.manage",
  ]),
};

/** Check a single permission for a role. */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as RoleId];
  return perms ? perms.has(permission) : false;
}

/** Check multiple permissions — true only if the role holds ALL of them. */
export function canAll(role: string | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/** Check multiple permissions — true if the role holds ANY of them. */
export function canAny(role: string | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}
