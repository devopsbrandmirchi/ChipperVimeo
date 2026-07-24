import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type {
  Subscription,
  SubscriptionInsert,
  SubscriptionUpdate,
} from "@/types/database";
import type { SubscriptionSearchOptions } from "@/types/repository";

const TABLE = "subscriptions";

export class SubscriptionRepository extends BaseRepository<
  Subscription,
  SubscriptionInsert,
  SubscriptionUpdate
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  /** Open subscriptions: not cancelled and not expired. */
  async findActive(limit = 100): Promise<Subscription[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .is("cancelled_at", null)
      .is("expired_at", null)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findActive");
    return (data ?? []) as Subscription[];
  }

  async findExpired(limit = 100): Promise<Subscription[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .not("expired_at", "is", null)
      .order("expired_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findExpired");
    return (data ?? []) as Subscription[];
  }

  async findCancelled(limit = 100): Promise<Subscription[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .not("cancelled_at", "is", null)
      .order("cancelled_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findCancelled");
    return (data ?? []) as Subscription[];
  }

  async findByCustomer(customerId: string): Promise<Subscription[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .order("started_at", { ascending: false, nullsFirst: false });

    if (error) this.throwMapped(error, "findByCustomer");
    return (data ?? []) as Subscription[];
  }

  async findByProduct(productId: string): Promise<Subscription[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("product_id", productId)
      .order("started_at", { ascending: false, nullsFirst: false });

    if (error) this.throwMapped(error, "findByProduct");
    return (data ?? []) as Subscription[];
  }

  /**
   * Current open subscription for a customer + product pair.
   * Matches the Phase 2 partial unique index definition.
   */
  async findCurrent(
    customerId: string,
    productId: string,
  ): Promise<Subscription | null> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .eq("product_id", productId)
      .is("cancelled_at", null)
      .is("expired_at", null)
      .maybeSingle();

    if (error) this.throwMapped(error, "findCurrent");
    return (data as Subscription | null) ?? null;
  }

  async search(options: SubscriptionSearchOptions): Promise<Subscription[]> {
    const limit = Math.min(options.limit ?? 50, 200);
    let query = this.db().from(TABLE).select("*");

    if (options.status) {
      query = query.eq("status", options.status);
    }
    if (options.billingFrequency) {
      query = query.eq("billing_frequency", options.billingFrequency);
    }
    if (options.productId) {
      query = query.eq("product_id", options.productId);
    }
    if (options.customerId) {
      query = query.eq("customer_id", options.customerId);
    }

    const { data, error } = await query
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) this.throwMapped(error, "search");
    return (data ?? []) as Subscription[];
  }
}
