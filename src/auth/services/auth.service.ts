import type { User, Session } from "@supabase/supabase-js";
import type { AuthError as SupabaseAuthError } from "@supabase/supabase-js";

import { AuthRepository } from "@/auth/repositories/auth.repository";
import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "@/auth/types/auth";
import {
  ForbiddenError,
  InvalidCredentialsError,
  UnauthorizedError,
  AuthError,
} from "@/auth/types/errors";
import {
  permissionsForRole,
  roleHasPermission,
  type Permission,
} from "@/auth/types/permissions";
import { roleFromAppMetadata, type AppRole } from "@/auth/types/roles";
import { defaultLogger, type Logger } from "@/processors/logger/logger";

function isSupabaseAuthError(error: unknown): error is SupabaseAuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "status" in error
  );
}

export class AuthService {
  private readonly logger: Logger;

  constructor(
    private readonly repo: AuthRepository,
    logger: Logger = defaultLogger,
  ) {
    this.logger = logger.child({ service: "auth" });
  }

  toAuthUser(user: User): AuthUser {
    const role = roleFromAppMetadata(
      user.app_metadata as Record<string, unknown> | undefined,
    );
    return {
      id: user.id,
      email: user.email ?? "",
      role,
      permissions: permissionsForRole(role),
      createdAt: user.created_at ?? null,
    };
  }

  toAuthSession(session: Session): AuthSession {
    return {
      accessToken: session.access_token,
      expiresAt: session.expires_at ?? null,
    };
  }

  async login(input: LoginInput): Promise<{
    user: AuthUser;
    session: AuthSession;
  }> {
    try {
      const { user, session } = await this.repo.signInWithPassword(
        input.email,
        input.password,
      );
      const authUser = this.toAuthUser(user);
      this.logger.info("Login success", {
        userId: authUser.id,
        email: authUser.email,
        role: authUser.role,
        rememberMe: input.rememberMe ?? false,
        action: "login",
      });
      return {
        user: authUser,
        session: this.toAuthSession(session),
      };
    } catch (error) {
      this.logger.warn("Login failed", {
        email: input.email,
        action: "login_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
      if (isSupabaseAuthError(error) && error.status === 400) {
        throw new InvalidCredentialsError(undefined, error);
      }
      throw new AuthError("Login failed", "auth_failed", error);
    }
  }

  async logout(): Promise<void> {
    const user = await this.repo.getUser();
    try {
      await this.repo.signOut();
      this.logger.info("Logout success", {
        userId: user?.id,
        email: user?.email,
        action: "logout",
      });
    } catch (error) {
      this.logger.error("Logout failed", {
        userId: user?.id,
        action: "logout_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
      throw new AuthError("Logout failed", "auth_failed", error);
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const user = await this.repo.getUser();
    if (!user) return null;
    return this.toAuthUser(user);
  }

  async getCurrentSession(): Promise<{
    user: AuthUser;
    session: AuthSession;
  } | null> {
    const user = await this.repo.getUser();
    if (!user) return null;
    const session = await this.repo.getSession();
    if (!session) return null;
    return {
      user: this.toAuthUser(user),
      session: this.toAuthSession(session),
    };
  }

  async refreshSession(): Promise<{
    user: AuthUser;
    session: AuthSession;
  } | null> {
    try {
      const result = await this.repo.refreshSession();
      if (!result) return null;
      this.logger.info("Session refreshed", {
        userId: result.user.id,
        action: "refresh_session",
      });
      return {
        user: this.toAuthUser(result.user),
        session: this.toAuthSession(result.session),
      };
    } catch (error) {
      this.logger.warn("Session refresh failed", {
        action: "refresh_session_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  }

  async validateSession(): Promise<AuthUser> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user;
  }

  /** Authenticated + valid role required for admin APIs/pages. */
  async requireAuthorizedUser(): Promise<AuthUser> {
    const user = await this.validateSession();
    if (!user.role) {
      throw new ForbiddenError("No role assigned to this account");
    }
    return user;
  }

  checkRole(user: AuthUser, role: AppRole): boolean {
    return user.role === role;
  }

  checkPermission(user: AuthUser, permission: Permission): boolean {
    return roleHasPermission(user.role, permission);
  }

  assertRole(user: AuthUser, role: AppRole): void {
    if (!this.checkRole(user, role)) {
      throw new ForbiddenError(`Requires role ${role}`);
    }
  }

  assertPermission(user: AuthUser, permission: Permission): void {
    if (!this.checkPermission(user, permission)) {
      throw new ForbiddenError(`Missing permission ${permission}`);
    }
  }

  async forgotPassword(
    input: ForgotPasswordInput,
    redirectTo: string,
  ): Promise<void> {
    try {
      await this.repo.resetPasswordForEmail(input.email, redirectTo);
      this.logger.info("Password reset email requested", {
        email: input.email,
        action: "password_reset_request",
      });
    } catch (error) {
      this.logger.warn("Password reset request failed", {
        email: input.email,
        action: "password_reset_request_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
      // Do not leak whether the email exists.
      throw new AuthError(
        "If that email exists, a reset link has been sent",
        "auth_failed",
        error,
      );
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<AuthUser> {
    try {
      const user = await this.repo.updatePassword(input.password);
      const authUser = this.toAuthUser(user);
      this.logger.info("Password reset completed", {
        userId: authUser.id,
        action: "password_reset",
      });
      return authUser;
    } catch (error) {
      this.logger.warn("Password reset failed", {
        action: "password_reset_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
      throw new AuthError("Password reset failed", "auth_failed", error);
    }
  }

  async changePassword(input: ChangePasswordInput): Promise<AuthUser> {
    const current = await this.validateSession();
    try {
      await this.repo.reauthenticate(current.email, input.currentPassword);
      const user = await this.repo.updatePassword(input.newPassword);
      const authUser = this.toAuthUser(user);
      this.logger.info("Password changed", {
        userId: authUser.id,
        action: "password_change",
      });
      return authUser;
    } catch (error) {
      this.logger.warn("Password change failed", {
        userId: current.id,
        action: "password_change_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
      if (isSupabaseAuthError(error) && error.status === 400) {
        throw new InvalidCredentialsError("Current password is incorrect", error);
      }
      throw new AuthError("Password change failed", "auth_failed", error);
    }
  }

  /** Audit shape reserved for future role-assignment APIs. */
  logRoleChange(fields: {
    actorId: string;
    targetUserId: string;
    previousRole: string | null;
    nextRole: string;
  }): void {
    this.logger.info("Role change recorded", {
      action: "role_change",
      ...fields,
    });
  }
}
