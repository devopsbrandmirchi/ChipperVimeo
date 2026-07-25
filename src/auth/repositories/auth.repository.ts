import type { SupabaseClient, User, Session } from "@supabase/supabase-js";

/**
 * Thin wrapper over Supabase Auth. No React, no business rules.
 * Always receives an anon-key cookie client — never the service role.
 */
export class AuthRepository {
  constructor(private readonly client: SupabaseClient) {}

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ user: User; session: Session }> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user || !data.session) {
      throw new Error("Sign-in returned no user or session");
    }
    return { user: data.user, session: data.session };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async getUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      // Missing/expired session surfaces as an auth error — treat as null.
      if (error.name === "AuthSessionMissingError" || error.status === 400) {
        return null;
      }
      throw error;
    }
    return data.user;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async refreshSession(): Promise<{ user: User; session: Session } | null> {
    const { data, error } = await this.client.auth.refreshSession();
    if (error) throw error;
    if (!data.user || !data.session) return null;
    return { user: data.user, session: data.session };
  }

  async resetPasswordForEmail(
    email: string,
    redirectTo: string,
  ): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }

  async updatePassword(newPassword: string): Promise<User> {
    const { data, error } = await this.client.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Password update returned no user");
    return data.user;
  }

  async reauthenticate(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }
}
