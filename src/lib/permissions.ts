import type { Role } from '@/lib/types';

/** Roles that may administer workspace-level configuration. */
export const ADMIN_ROLES: Role[] = ['super_admin', 'org_admin'];

/** Roles that may create and edit risk records (mirrors the web permissions). */
export const RISK_WRITE_ROLES: Role[] = ['super_admin', 'org_admin', 'grc_analyst', 'it_security'];

/** Roles that may review/approve remediation tasks (PRD 2.7). */
export const TASK_REVIEW_ROLES: Role[] = ['super_admin', 'org_admin', 'grc_analyst'];

/** Roles that may approve/reject evidence submissions (PRD 2.6). */
export const EVIDENCE_REVIEW_ROLES: Role[] = ['super_admin', 'org_admin', 'grc_analyst'];

export function hasRole(role: string | null | undefined, allowed: readonly Role[]): boolean {
  if (!role) return false;
  return (allowed as readonly string[]).includes(String(role).trim().toLowerCase());
}

export function isAdmin(role: string | null | undefined): boolean {
  return hasRole(role, ADMIN_ROLES);
}

export function canActivateFramework(role: string | null | undefined): boolean {
  return hasRole(role, ADMIN_ROLES);
}

export function canCreateFramework(role: string | null | undefined): boolean {
  return hasRole(role, ADMIN_ROLES);
}

export function canCloneFramework(role: string | null | undefined): boolean {
  return hasRole(role, ADMIN_ROLES);
}

export function canAddRisk(role: string | null | undefined): boolean {
  return hasRole(role, RISK_WRITE_ROLES);
}

export function canReviewTask(role: string | null | undefined): boolean {
  return hasRole(role, TASK_REVIEW_ROLES);
}

export function canAddTask(role: string | null | undefined): boolean {
  return hasRole(role, TASK_REVIEW_ROLES);
}

export function canReviewEvidence(role: string | null | undefined): boolean {
  return hasRole(role, EVIDENCE_REVIEW_ROLES);
}
