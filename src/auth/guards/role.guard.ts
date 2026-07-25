import type { AuthUser } from "@/auth/types/auth";
import { ForbiddenError } from "@/auth/types/errors";
import type { Permission } from "@/auth/types/permissions";
import { roleHasPermission } from "@/auth/types/permissions";
import type { AppRole } from "@/auth/types/roles";

export function requireRole(user: AuthUser, role: AppRole): void {
  if (user.role !== role) {
    throw new ForbiddenError(`Requires role ${role}`);
  }
}

export function requireAnyRole(user: AuthUser, roles: AppRole[]): void {
  if (!user.role || !roles.includes(user.role)) {
    throw new ForbiddenError(
      `Requires one of: ${roles.join(", ")}`,
    );
  }
}

export function requirePermission(
  user: AuthUser,
  permission: Permission,
): void {
  if (!roleHasPermission(user.role, permission)) {
    throw new ForbiddenError(`Missing permission ${permission}`);
  }
}
