/**
 * Configurable permission matrix. Add roles/permissions here — no schema change.
 */

import type { AppRole } from "@/auth/types/roles";

export const PERMISSIONS = [
  "customers:view",
  "customers:edit",
  "customers:delete",
  "customers:export",
  "subscriptions:view",
  "subscriptions:export",
  "products:view",
  "products:edit",
  "products:export",
  "payments:view",
  "payments:export",
  "webhook_events:view",
  "analytics:view",
  "analytics:export",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const VIEW_PERMISSIONS: Permission[] = [
  "customers:view",
  "subscriptions:view",
  "products:view",
  "payments:view",
  "webhook_events:view",
  "analytics:view",
];

/**
 * Role → permissions. ADMIN is fully provisioned.
 * Other roles have conservative defaults for future assignment.
 */
export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  MANAGER: [
    ...VIEW_PERMISSIONS,
    "customers:edit",
    "customers:export",
    "subscriptions:export",
    "payments:export",
    "products:export",
    "analytics:export",
    "products:edit",
  ],
  ANALYST: [
    "customers:view",
    "customers:export",
    "subscriptions:view",
    "subscriptions:export",
    "products:view",
    "payments:view",
    "payments:export",
    "webhook_events:view",
    "analytics:view",
    "analytics:export",
  ],
  READ_ONLY: VIEW_PERMISSIONS,
};

export function permissionsForRole(role: AppRole | null): Permission[] {
  if (!role) return [];
  return [...ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(
  role: AppRole | null,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
