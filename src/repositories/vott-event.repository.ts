import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import { RepositoryError } from "@/types/errors";
import type {
  PaginateOptions,
  PaginatedResult,
  DateRangeOptions,
} from "@/types/repository";
import type {
  VottEvent,
  VottEventFilters,
  VottEventInsert,
} from "@/types/vimeo";

const TABLE = "vott_events";

/** vott_events rows are effectively immutable; updates are unused. */
type VottEventUpdate = Partial<VottEventInsert>;

export class VottEventRepository extends BaseRepository<
  VottEvent,
  VottEventInsert,
  VottEventUpdate
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  /** Insert a raw webhook delivery (Phase 1 ingest). */
  async insert(event: VottEventInsert): Promise<VottEvent> {
    return this.create(event);
  }

  async findByTopic(topic: string, limit = 100): Promise<VottEvent[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("topic", topic)
      .order("received_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findByTopic");
    return (data ?? []) as VottEvent[];
  }

  async findBetweenDates(options: DateRangeOptions): Promise<VottEvent[]> {
    const limit = Math.min(options.limit ?? 100, 200);
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .gte("received_date", options.from)
      .lte("received_date", options.to)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) this.throwMapped(error, "findBetweenDates");
    return (data ?? []) as VottEvent[];
  }

  async findCustomerEvents(
    customerId: number,
    limit = 100,
  ): Promise<VottEvent[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .order("received_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findCustomerEvents");
    return (data ?? []) as VottEvent[];
  }

  async findProductEvents(
    productId: number,
    limit = 100,
  ): Promise<VottEvent[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("product_id", productId)
      .order("received_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findProductEvents");
    return (data ?? []) as VottEvent[];
  }

  /**
   * Events with no matching subscription_events.vott_event_id.
   * Processing status is derived (no status columns on vott_events).
   */
  async findPending(limit = 100): Promise<VottEvent[]> {
    const capped = Math.min(limit, 200);
    const overFetch = Math.min(capped * 5, 1000);

    const { data: events, error } = await this.db()
      .from(TABLE)
      .select("*")
      .order("received_at", { ascending: true })
      .limit(overFetch);

    if (error) this.throwMapped(error, "findPending");

    const candidates = (events ?? []) as VottEvent[];
    if (candidates.length === 0) return [];

    const candidateIds = candidates.map((e) => e.id);
    const { data: processed, error: processedError } = await this.db()
      .from("subscription_events")
      .select("vott_event_id")
      .in("vott_event_id", candidateIds);

    if (processedError) this.throwMapped(processedError, "findPending");

    const done = new Set(
      (processed ?? []).map((row) => row.vott_event_id as string),
    );

    return candidates.filter((e) => !done.has(e.id)).slice(0, capped);
  }

  /**
   * Failure state cannot be stored without schema columns.
   * Always returns an empty list until a future migration adds processing_status.
   */
  async findFailed(_limit = 100): Promise<VottEvent[]> {
    return [];
  }

  /**
   * No-op: “processed” is implied when Phase 4 creates a subscription_events row.
   */
  async markProcessed(_id: string): Promise<void> {
    return;
  }

  /**
   * Not supported until vott_events gains processing_error / status columns.
   */
  async markFailed(_id: string, _reason?: string): Promise<never> {
    throw new RepositoryError(
      "NotSupported",
      "markFailed requires processing_status columns on vott_events (not present). Record failures outside the event store until a future migration.",
      { table: TABLE },
    );
  }

  /** Legacy filter shape used by admin list APIs. */
  async list(filters: VottEventFilters = {}): Promise<VottEvent[]> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    let query = this.db()
      .from(TABLE)
      .select("*")
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.topic) {
      query = query.eq("topic", filters.topic);
    }
    if (typeof filters.customerId === "number") {
      query = query.eq("customer_id", filters.customerId);
    }
    if (filters.customerEmail) {
      query = query.ilike("customer_email", filters.customerEmail);
    }
    if (filters.from) {
      query = query.gte("received_date", filters.from);
    }
    if (filters.to) {
      query = query.lte("received_date", filters.to);
    }

    const { data, error } = await query;
    if (error) this.throwMapped(error, "list");
    return (data ?? []) as VottEvent[];
  }

  override async paginate(
    opts: PaginateOptions = {},
  ): Promise<PaginatedResult<VottEvent>> {
    return super.paginate({
      ...opts,
      sortBy: opts.sortBy ?? "received_at",
      sortDirection: opts.sortDirection ?? "desc",
    });
  }
}
