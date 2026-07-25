import { createAuthServerClient } from "@/lib/supabase/server-auth";
import { AuthRepository } from "@/auth/repositories/auth.repository";
import { AuthService } from "@/auth/services/auth.service";
import type { AuthUser } from "@/auth/types/auth";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/auth/types/errors";

export async function createAuthService(): Promise<AuthService> {
  const client = await createAuthServerClient();
  return new AuthService(new AuthRepository(client));
}

/** Require a valid Supabase session. Throws UnauthorizedError. */
export async function requireAuth(): Promise<AuthUser> {
  const service = await createAuthService();
  return service.validateSession();
}

/**
 * Require session + assigned app role (ADMIN / MANAGER / …).
 * Throws UnauthorizedError or ForbiddenError.
 */
export async function requireAuthorizedUser(): Promise<AuthUser> {
  const service = await createAuthService();
  return service.requireAuthorizedUser();
}

export function assertAuthenticated(user: AuthUser | null): asserts user is AuthUser {
  if (!user) {
    throw new UnauthorizedError();
  }
}

export function assertHasRole(user: AuthUser): void {
  if (!user.role) {
    throw new ForbiddenError("No role assigned to this account");
  }
}
