import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/server";

export type AuthAuditInsert = {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetUserId: string | null;
  targetEmail: string | null;
  details?: Record<string, unknown>;
};

export type AuthAuditEvent = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export class AuthAuditRepository {
  constructor(private readonly client: SupabaseClient = createServiceClient()) {}

  async insert(row: AuthAuditInsert): Promise<void> {
    const { error } = await this.client.from("auth_audit_events").insert({
      actor_id: row.actorId,
      actor_email: row.actorEmail,
      action: row.action,
      target_user_id: row.targetUserId,
      target_email: row.targetEmail,
      details: row.details ?? {},
    });
    if (error) throw error;
  }

  async listRecent(limit = 50): Promise<AuthAuditEvent[]> {
    const { data, error } = await this.client
      .from("auth_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw error;
    return (data ?? []) as AuthAuditEvent[];
  }
}
