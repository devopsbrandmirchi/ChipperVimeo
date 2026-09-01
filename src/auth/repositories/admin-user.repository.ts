import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/server";
import type { AppRole } from "@/auth/types/roles";

export type AdminUserRecord = {
  id: string;
  email: string;
  role: AppRole | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  banned: boolean;
};

/**
 * Supabase Auth Admin API (service role). Never import from client components.
 */
export class AdminUserRepository {
  constructor(private readonly client: SupabaseClient = createServiceClient()) {}

  async listUsers(page = 1, perPage = 100): Promise<AdminUserRecord[]> {
    const { data, error } = await this.client.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    return (data.users ?? []).map((u) => this.toRecord(u));
  }

  async getUserById(id: string): Promise<AdminUserRecord | null> {
    const { data, error } = await this.client.auth.admin.getUserById(id);
    if (error) {
      if (error.status === 404 || error.message?.toLowerCase().includes("not found")) {
        return null;
      }
      throw error;
    }
    return data.user ? this.toRecord(data.user) : null;
  }

  async inviteUser(email: string, redirectTo: string): Promise<AdminUserRecord> {
    const { data, error } = await this.client.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );
    if (error) throw error;
    if (!data.user) throw new Error("Invite returned no user");
    return this.toRecord(data.user);
  }

  async createUser(input: {
    email: string;
    password: string;
    role: AppRole;
  }): Promise<AdminUserRecord> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Create user returned no user");
    return this.toRecord(data.user);
  }

  async updateRole(id: string, role: AppRole): Promise<AdminUserRecord> {
    const { data, error } = await this.client.auth.admin.updateUserById(id, {
      app_metadata: { role },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Update role returned no user");
    return this.toRecord(data.user);
  }

  private toRecord(user: User): AdminUserRecord {
    const meta = user.app_metadata as Record<string, unknown> | undefined;
    const roleRaw = meta?.role;
    const role =
      typeof roleRaw === "string" &&
      ["ADMIN", "MANAGER", "ANALYST", "READ_ONLY"].includes(roleRaw)
        ? (roleRaw as AppRole)
        : null;

    return {
      id: user.id,
      email: user.email ?? "",
      role,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      banned: Boolean(
        (user as User & { banned_until?: string | null }).banned_until,
      ),
    };
  }
}
