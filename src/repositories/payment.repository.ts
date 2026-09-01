import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type { Payment, PaymentInsert, PaymentUpdate } from "@/types/database";
import type {
  DateRangeOptions,
  PaginatedResult,
  PaymentListFilterOptions,
} from "@/types/repository";

const TABLE = "payments";

const SUCCESS_STATUSES = ["succeeded", "paid", "success", "completed"];
const FAILED_STATUSES = ["failed", "failure", "declined", "charge_failed"];

export class PaymentRepository extends BaseRepository<
  Payment,
  PaymentInsert,
  PaymentUpdate
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  async findByCustomer(customerId: string): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) this.throwMapped(error, "findByCustomer");
    return (data ?? []) as Payment[];
  }

  async findBySubscription(subscriptionId: string): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) this.throwMapped(error, "findBySubscription");
    return (data ?? []) as Payment[];
  }

  async findFailed(limit = 100): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .in("status", FAILED_STATUSES)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findFailed");
    return (data ?? []) as Payment[];
  }

  async findSuccessful(limit = 100): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .in("status", SUCCESS_STATUSES)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findSuccessful");
    return (data ?? []) as Payment[];
  }

  async findBetweenDates(options: DateRangeOptions): Promise<Payment[]> {
    const limit = Math.min(options.limit ?? 100, 200);
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .gte("payment_date", options.from)
      .lte("payment_date", options.to)
      .order("payment_date", { ascending: false })
      .limit(limit);

    if (error) this.throwMapped(error, "findBetweenDates");
    return (data ?? []) as Payment[];
  }

  /**
   * SQL-level filters + pagination for the admin payments ledger.
   * Supports date range and productId without the ≤200 candidate path.
   */
  async paginateFiltered(
    opts: PaymentListFilterOptions = {},
  ): Promise<PaginatedResult<Payment>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(Math.max(1, opts.pageSize ?? 25), 10_000);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = opts.sortBy ?? "payment_date";
    const ascending = (opts.sortDirection ?? "desc") === "asc";

    let query = this.db().from(TABLE).select("*", { count: "exact" });

    if (opts.status) {
      query = query.ilike("status", opts.status);
    }
    if (opts.customerId) {
      query = query.eq("customer_id", opts.customerId);
    }
    if (opts.subscriptionId) {
      query = query.eq("subscription_id", opts.subscriptionId);
    }
    if (opts.productId) {
      query = query.eq("product_id", opts.productId);
    }
    if (opts.currency) {
      query = query.ilike("currency", opts.currency);
    }
    if (opts.from) {
      query = query.gte("payment_date", opts.from);
    }
    if (opts.to) {
      query = query.lte("payment_date", `${opts.to}T23:59:59.999Z`);
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending, nullsFirst: false })
      .range(from, to);

    if (error) this.throwMapped(error, "paginateFiltered");
    const total = count ?? 0;
    return {
      items: (data ?? []) as Payment[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    };
  }
}
