import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type {
  Subscription,
  SubscriptionInsert,
  SubscriptionUpdate,
} from "@/types/database";
import type {
  PaginateOptions,
  PaginatedResult,
  SubscriptionListFilterOptions,
  SubscriptionSearchOptions,
} from "@/types/repository";

const TABLE = "subscriptions";

function sanitizeFilterTerm(value: string): string {
  return value.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
}

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
      query = query.ilike("status", `%${sanitizeFilterTerm(options.status)}%`);
    }
    if (options.billingFrequency) {
      query = query.ilike(
        "billing_frequency",
        `%${sanitizeFilterTerm(options.billingFrequency)}%`,
      );
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

  async paginateFiltered(
    opts: SubscriptionListFilterOptions = {},
  ): Promise<PaginatedResult<Subscription>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(Math.max(1, opts.pageSize ?? 25), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = opts.sortBy ?? "started_at";
    const ascending = (opts.sortDirection ?? "desc") === "asc";

    let query = this.db().from(TABLE).select("*", { count: "exact" });

    if (opts.status) {
      query = query.ilike("status", `%${sanitizeFilterTerm(opts.status)}%`);
    }
    if (opts.billingFrequency) {
      query = query.ilike(
        "billing_frequency",
        `%${sanitizeFilterTerm(opts.billingFrequency)}%`,
      );
    }
    if (opts.productId) {
      query = query.eq("product_id", opts.productId);
    }
    if (opts.customerId) {
      query = query.eq("customer_id", opts.customerId);
    }
    if (opts.trial === true) {
      query = query.eq("free_trial", true);
    } else if (opts.trial === false) {
      query = query.or("free_trial.is.null,free_trial.eq.false");
    }
    if (opts.renewalFrom) {
      query = query.gte("renewal_date", opts.renewalFrom);
    }
    if (opts.renewalTo) {
      query = query.lte("renewal_date", `${opts.renewalTo}T23:59:59.999Z`);
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending, nullsFirst: false })
      .range(from, to);

    if (error) this.throwMapped(error, "paginateFiltered");
    const total = count ?? 0;
    return {
      items: (data ?? []) as Subscription[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
