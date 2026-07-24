import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/server";
import { RepositoryError, type RepositoryErrorCode } from "@/types/errors";
import type { PaginateOptions, PaginatedResult } from "@/types/repository";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

type FilterValue = string | number | boolean | null | undefined;

/**
 * Map PostgREST / Postgres error codes to typed RepositoryError.
 * Never surface raw Supabase errors to callers.
 */
export function mapSupabaseError(
  error: PostgrestError,
  table: string,
  context?: string,
): RepositoryError {
  const code = error.code ?? "";
  const message = context
    ? `${context}: ${error.message}`
    : error.message;

  let appCode: RepositoryErrorCode = "DatabaseError";

  if (code === "PGRST116") {
    appCode = "NotFound";
  } else if (code === "23505") {
    appCode = "UniqueViolation";
  } else if (code === "23503") {
    appCode = "ForeignKeyViolation";
  } else if (code === "23514") {
    appCode = "CheckViolation";
  }

  return new RepositoryError(appCode, message, { table, cause: error });
}

function clampPageSize(pageSize: number | undefined): number {
  const size = pageSize ?? DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, size), MAX_PAGE_SIZE);
}

function normalizePage(page: number | undefined): number {
  return Math.max(1, page ?? DEFAULT_PAGE);
}

/**
 * Generic data-access base. Subclasses add domain-specific queries only.
 * Optional `client` injection supports a future shared Service-Layer client / RPC tx.
 */
export class BaseRepository<
  TRow extends { id: string },
  TInsert extends object,
  TUpdate extends object,
> {
  constructor(
    protected readonly table: string,
    protected readonly client?: SupabaseClient,
  ) {}

  protected db(): SupabaseClient {
    return this.client ?? createServiceClient();
  }

  protected throwMapped(
    error: PostgrestError,
    context?: string,
  ): never {
    throw mapSupabaseError(error, this.table, context);
  }

  /**
   * Apply simple equality / IS NULL filters. T is the PostgREST builder chain type.
   */
  protected applyEqFilters<
    T extends {
      eq: (column: string, value: string | number | boolean) => T;
      is: (column: string, value: null) => T;
    },
  >(query: T, filters?: Record<string, FilterValue>): T {
    if (!filters) return query;
    let next = query;
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;
      if (value === null) {
        next = next.is(key, null);
      } else {
        next = next.eq(key, value);
      }
    }
    return next;
  }

  async findById(id: string): Promise<TRow | null> {
    const { data, error } = await this.db()
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) this.throwMapped(error, "findById");
    return (data as TRow | null) ?? null;
  }

  async findAll(options?: {
    limit?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    filters?: Record<string, FilterValue>;
  }): Promise<TRow[]> {
    const limit = Math.min(options?.limit ?? 100, MAX_PAGE_SIZE);
    const sortBy = options?.sortBy ?? "created_at";
    const ascending = (options?.sortDirection ?? "desc") === "asc";

    let query = this.db()
      .from(this.table)
      .select("*")
      .order(sortBy, { ascending })
      .limit(limit);

    query = this.applyEqFilters(query, options?.filters);

    const { data, error } = await query;
    if (error) this.throwMapped(error, "findAll");
    return (data ?? []) as TRow[];
  }

  async create(row: TInsert): Promise<TRow> {
    const { data, error } = await this.db()
      .from(this.table)
      .insert(row)
      .select()
      .single();

    if (error) this.throwMapped(error, "create");
    return data as TRow;
  }

  async update(id: string, patch: TUpdate): Promise<TRow> {
    const { data, error } = await this.db()
      .from(this.table)
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) this.throwMapped(error, "update");
    if (!data) {
      throw new RepositoryError("NotFound", `No ${this.table} row with id ${id}`, {
        table: this.table,
      });
    }
    return data as TRow;
  }

  async delete(id: string): Promise<void> {
    const { error, count } = await this.db()
      .from(this.table)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) this.throwMapped(error, "delete");
    if (count === 0) {
      throw new RepositoryError("NotFound", `No ${this.table} row with id ${id}`, {
        table: this.table,
      });
    }
  }

  async upsert(row: TInsert, onConflict: string): Promise<TRow> {
    const { data, error } = await this.db()
      .from(this.table)
      .upsert(row, { onConflict })
      .select()
      .single();

    if (error) this.throwMapped(error, "upsert");
    return data as TRow;
  }

  async exists(id: string): Promise<boolean> {
    const { data, error } = await this.db()
      .from(this.table)
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (error) this.throwMapped(error, "exists");
    return data !== null;
  }

  async count(filters?: Record<string, FilterValue>): Promise<number> {
    let query = this.db()
      .from(this.table)
      .select("*", { count: "exact", head: true });

    query = this.applyEqFilters(query, filters);

    const { count, error } = await query;
    if (error) this.throwMapped(error, "count");
    return count ?? 0;
  }

  async paginate(opts: PaginateOptions = {}): Promise<PaginatedResult<TRow>> {
    const page = normalizePage(opts.page);
    const pageSize = clampPageSize(opts.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = opts.sortBy ?? "created_at";
    const ascending = (opts.sortDirection ?? "desc") === "asc";

    let query = this.db()
      .from(this.table)
      .select("*", { count: "exact" })
      .order(sortBy, { ascending })
      .range(from, to);

    query = this.applyEqFilters(query, opts.filters);

    const { data, error, count } = await query;
    if (error) this.throwMapped(error, "paginate");

    const total = count ?? 0;
    return {
      items: (data ?? []) as TRow[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
