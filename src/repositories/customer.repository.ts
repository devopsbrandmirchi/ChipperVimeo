import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type {
  Customer,
  CustomerInsert,
  CustomerSubscriptionPatch,
  CustomerUpdate,
} from "@/types/database";
import type {
  CustomerSearchOptions,
  PaginateOptions,
  PaginatedResult,
} from "@/types/repository";

const TABLE = "customers";

const ACTIVE_STATUSES = ["active", "enabled", "subscribed"];

export class CustomerRepository extends BaseRepository<
  Customer,
  CustomerInsert,
  CustomerUpdate
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  async findByVimeoCustomerId(
    vimeoCustomerId: number,
  ): Promise<Customer | null> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("vimeo_customer_id", vimeoCustomerId)
      .maybeSingle();

    if (error) this.throwMapped(error, "findByVimeoCustomerId");
    return (data as Customer | null) ?? null;
  }

  async findByEmail(email: string): Promise<Customer[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false });

    if (error) this.throwMapped(error, "findByEmail");
    return (data ?? []) as Customer[];
  }

  async findByPlatform(platform: string): Promise<Customer[]> {
    return this.findAll({
      filters: { platform },
      sortBy: "last_seen_at",
      sortDirection: "desc",
    });
  }

  async findByCountry(country: string): Promise<Customer[]> {
    return this.findAll({
      filters: { country },
      sortBy: "last_seen_at",
      sortDirection: "desc",
    });
  }

  async findByStatus(subscriptionStatus: string): Promise<Customer[]> {
    return this.findAll({
      filters: { subscription_status: subscriptionStatus },
      sortBy: "last_seen_at",
      sortDirection: "desc",
    });
  }

  async findActive(limit = 100): Promise<Customer[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .in("subscription_status", ACTIVE_STATUSES)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findActive");
    return (data ?? []) as Customer[];
  }

  async upsertByVimeoId(row: CustomerInsert): Promise<Customer> {
    return this.upsert(row, "vimeo_customer_id");
  }

  async updateLastSeen(
    id: string,
    lastSeenAt: string = new Date().toISOString(),
  ): Promise<Customer> {
    return this.update(id, { last_seen_at: lastSeenAt });
  }

  /** Patch customer subscription snapshot fields (no business rules). */
  async updateSubscription(
    id: string,
    patch: CustomerSubscriptionPatch,
  ): Promise<Customer> {
    return this.update(id, patch);
  }

  async search(options: CustomerSearchOptions): Promise<Customer[]> {
    const limit = Math.min(options.limit ?? 50, 200);
    let query = this.db().from(TABLE).select("*");

    if (options.email) {
      query = query.ilike("email", `%${options.email}%`);
    }
    if (options.name) {
      query = query.or(
        `full_name.ilike.%${options.name}%,first_name.ilike.%${options.name}%,last_name.ilike.%${options.name}%`,
      );
    }
    if (options.country) {
      query = query.eq("country", options.country);
    }
    if (options.platform) {
      query = query.eq("platform", options.platform);
    }
    if (options.status) {
      query = query.eq("subscription_status", options.status);
    }

    const { data, error } = await query
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) this.throwMapped(error, "search");
    return (data ?? []) as Customer[];
  }

  override async paginate(
    opts: PaginateOptions = {},
  ): Promise<PaginatedResult<Customer>> {
    return super.paginate({
      ...opts,
      sortBy: opts.sortBy ?? "created_at",
    });
  }
}
