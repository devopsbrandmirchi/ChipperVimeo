/**
 * Application roles. Only ADMIN is assigned in Phase 7;
 * others exist so RBAC wiring needs no redesign later.
 */

export const APP_ROLES = [
  "ADMIN",
  "MANAGER",
  "ANALYST",
  "READ_ONLY",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    (APP_ROLES as readonly string[]).includes(value)
  );
}

/** Read role from Supabase Auth app_metadata. */
export function roleFromAppMetadata(
  appMetadata: Record<string, unknown> | undefined,
): AppRole | null {
  if (!appMetadata) return null;
  const role = appMetadata.role;
  return isAppRole(role) ? role : null;
}
