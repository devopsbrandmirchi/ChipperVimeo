import type { AuthUser } from "@/auth/types/auth";
import { AuthError, ForbiddenError } from "@/auth/types/errors";
import { APP_ROLES, isAppRole, type AppRole } from "@/auth/types/roles";
import {
  AdminUserRepository,
  type AdminUserRecord,
} from "@/auth/repositories/admin-user.repository";
import {
  AuthAuditRepository,
  type AuthAuditEvent,
} from "@/auth/repositories/auth-audit.repository";
import { defaultLogger, type Logger } from "@/processors/logger/logger";
import { ServiceValidationError } from "@/services/shared/errors";

export type InviteUserInput = {
  email: string;
  role: AppRole;
  method: "invite" | "create";
  password?: string;
};

export class AdminUserService {
  private readonly logger: Logger;

  constructor(
    private readonly users: AdminUserRepository = new AdminUserRepository(),
    private readonly audit: AuthAuditRepository = new AuthAuditRepository(),
    logger: Logger = defaultLogger,
  ) {
    this.logger = logger.child({ service: "admin-users" });
  }

  async listUsers(): Promise<AdminUserRecord[]> {
    const page1 = await this.users.listUsers(1, 100);
    // Auth Admin API pages at 100; fetch a second page if full.
    if (page1.length < 100) return page1;
    const page2 = await this.users.listUsers(2, 100);
    return [...page1, ...page2];
  }

  async listAudit(limit = 50): Promise<AuthAuditEvent[]> {
    try {
      return await this.audit.listRecent(limit);
    } catch (error) {
      this.logger.warn("Audit list failed (table may be missing)", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return [];
    }
  }

  async inviteOrCreate(
    actor: AuthUser,
    input: InviteUserInput,
  ): Promise<AdminUserRecord> {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new ServiceValidationError("Valid email is required");
    }
    if (!isAppRole(input.role)) {
      throw new ServiceValidationError(
        `Role must be one of: ${APP_ROLES.join(", ")}`,
      );
    }

    try {
      let user: AdminUserRecord;

      if (input.method === "create") {
        const password = input.password?.trim() ?? "";
        if (password.length < 8) {
          throw new ServiceValidationError(
            "Password must be at least 8 characters for create method",
          );
        }
        user = await this.users.createUser({
          email,
          password,
          role: input.role,
        });
      } else {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
          "http://localhost:3000";
        user = await this.users.inviteUser(
          email,
          `${appUrl}/reset-password`,
        );
        user = await this.users.updateRole(user.id, input.role);
      }

      await this.safeAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: input.method === "create" ? "user_create" : "user_invite",
        targetUserId: user.id,
        targetEmail: user.email,
        details: { role: input.role, method: input.method },
      });

      this.logger.info("User provisioned", {
        action: input.method,
        actorId: actor.id,
        targetUserId: user.id,
        role: input.role,
      });

      return user;
    } catch (error) {
      if (error instanceof ServiceValidationError) throw error;
      const message =
        error instanceof Error ? error.message : "Failed to provision user";
      throw new AuthError(message, "auth_failed", error);
    }
  }

  async updateRole(
    actor: AuthUser,
    targetUserId: string,
    nextRole: AppRole,
  ): Promise<AdminUserRecord> {
    if (!isAppRole(nextRole)) {
      throw new ServiceValidationError(
        `Role must be one of: ${APP_ROLES.join(", ")}`,
      );
    }

    const target = await this.users.getUserById(targetUserId);
    if (!target) {
      throw new AuthError("User not found", "auth_failed");
    }

    if (actor.id === targetUserId && nextRole !== "ADMIN") {
      throw new ForbiddenError("You cannot remove your own ADMIN role");
    }

    if (target.role === "ADMIN" && nextRole !== "ADMIN") {
      const all = await this.listUsers();
      const adminCount = all.filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        throw new ForbiddenError("Cannot demote the last ADMIN");
      }
    }

    const previousRole = target.role;
    const updated = await this.users.updateRole(targetUserId, nextRole);

    await this.safeAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "role_change",
      targetUserId: updated.id,
      targetEmail: updated.email,
      details: { previousRole, nextRole },
    });

    this.logger.info("Role change recorded", {
      action: "role_change",
      actorId: actor.id,
      targetUserId: updated.id,
      previousRole,
      nextRole,
    });

    return updated;
  }

  private async safeAudit(row: {
    actorId: string;
    actorEmail: string;
    action: string;
    targetUserId: string;
    targetEmail: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.audit.insert(row);
    } catch (error) {
      this.logger.warn("Failed to write auth audit event", {
        action: row.action,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
