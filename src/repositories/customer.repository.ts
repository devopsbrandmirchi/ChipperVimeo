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
  CustomerListFilterOptions,
  PaginateOptions,
  PaginatedResult,
} from "@/types/repository";

const TABLE = "customers";

const ACTIVE_STATUSES = ["active", "enabled", "subscribed"];

/** Strip PostgREST filter metacharacters from user input. */
function sanitizeFilterTerm(value: string): string {
  return value.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
}

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

    const email = options.email ? sanitizeFilterTerm(options.email) : "";
    const name = options.name ? sanitizeFilterTerm(options.name) : "";

    // UI search passes the same term for email + name — OR them, don't AND.
    if (email && name && email === name) {
      query = query.or(
        `email.ilike.%${email}%,full_name.ilike.%${email}%,first_name.ilike.%${email}%,last_name.ilike.%${email}%`,
      );
    } else {
      if (email) {
        query = query.ilike("email", `%${email}%`);
      }
      if (name) {
        query = query.or(
          `full_name.ilike.%${name}%,first_name.ilike.%${name}%,last_name.ilike.%${name}%`,
        );
      }
    }
    if (options.country) {
      query = query.ilike("country", `%${sanitizeFilterTerm(options.country)}%`);
    }
    if (options.platform) {
      query = query.ilike(
        "platform",
        `%${sanitizeFilterTerm(options.platform)}%`,
      );
    }
    if (options.plan) {
      query = query.ilike("plan", `%${sanitizeFilterTerm(options.plan)}%`);
    }
    if (options.status) {
      query = query.ilike(
        "subscription_status",
        `%${sanitizeFilterTerm(options.status)}%`,
      );
    }

    const { data, error } = await query
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) this.throwMapped(error, "search");
    return (data ?? []) as Customer[];
  }

  /**
   * Server-side filtered pagination for /customers (ilike + OR search).
   */
  async paginateFiltered(
    opts: CustomerListFilterOptions = {},
  ): Promise<PaginatedResult<Customer>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(Math.max(1, opts.pageSize ?? 25), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = opts.sortBy ?? "created_at";
    const ascending = (opts.sortDirection ?? "desc") === "asc";

    let query = this.db()
      .from(TABLE)
      .select("*", { count: "exact" });

    const search = opts.search ? sanitizeFilterTerm(opts.search) : "";
    if (search) {
      query = query.or(
        `email.ilike.%${search}%,full_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      );
    }
    if (opts.country) {
      query = query.ilike("country", `%${sanitizeFilterTerm(opts.country)}%`);
    }
    if (opts.platform) {
      query = query.ilike("platform", `%${sanitizeFilterTerm(opts.platform)}%`);
    }
    if (opts.plan) {
      query = query.ilike("plan", `%${sanitizeFilterTerm(opts.plan)}%`);
    }
    if (opts.status) {
      query = query.ilike(
        "subscription_status",
        `%${sanitizeFilterTerm(opts.status)}%`,
      );
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending, nullsFirst: false })
      .range(from, to);

    if (error) this.throwMapped(error, "paginateFiltered");
    const total = count ?? 0;
    return {
      items: (data ?? []) as Customer[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
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
