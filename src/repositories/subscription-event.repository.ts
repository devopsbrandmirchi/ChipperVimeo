import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type {
  SubscriptionEvent,
  SubscriptionEventInsert,
} from "@/types/database";

const TABLE = "subscription_events";

/** Append-only lifecycle log. Update/delete are intentionally unused. */
export class SubscriptionEventRepository extends BaseRepository<
  SubscriptionEvent,
  SubscriptionEventInsert,
  never
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  async createMany(
    rows: SubscriptionEventInsert[],
  ): Promise<SubscriptionEvent[]> {
    if (rows.length === 0) return [];

    const { data, error } = await this.db()
      .from(TABLE)
      .insert(rows)
      .select();

    if (error) this.throwMapped(error, "createMany");
    return (data ?? []) as SubscriptionEvent[];
  }

  /** Customer journey ordered by event time ascending. */
  async findTimeline(customerId: string): Promise<SubscriptionEvent[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .order("event_created_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) this.throwMapped(error, "findTimeline");
    return (data ?? []) as SubscriptionEvent[];
  }

  async findCustomerEvents(
    customerId: string,
    limit = 100,
  ): Promise<SubscriptionEvent[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .order("event_created_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findCustomerEvents");
    return (data ?? []) as SubscriptionEvent[];
  }

  async findSubscriptionEvents(
    subscriptionId: string,
    limit = 100,
  ): Promise<SubscriptionEvent[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("event_created_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findSubscriptionEvents");
    return (data ?? []) as SubscriptionEvent[];
  }

  async findByVottEventId(
    vottEventId: string,
  ): Promise<SubscriptionEvent | null> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("vott_event_id", vottEventId)
      .maybeSingle();

    if (error) this.throwMapped(error, "findByVottEventId");
    return (data as SubscriptionEvent | null) ?? null;
  }
}
