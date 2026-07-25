/**
 * Framework-agnostic pagination / sort DTOs for the API + service layers.
 * Composes with existing repository pagination types — no Next.js imports.
 */

import type {
  PaginatedResult,
  PaginateOptions,
  SortDirection,
} from "@/types/repository";

export type { SortDirection, PaginatedResult, PaginateOptions };

export type ApiPageRequest = {
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: SortDirection;
};

export const DEFAULT_API_PAGE = 1;
export const DEFAULT_API_PAGE_SIZE = 25;
export const MAX_API_PAGE_SIZE = 200;

export function normalizePageRequest(
  input: ApiPageRequest = {},
): Required<Pick<ApiPageRequest, "page" | "pageSize">> &
  Pick<ApiPageRequest, "sort" | "direction"> {
  const page = Math.max(1, input.page ?? DEFAULT_API_PAGE);
  const pageSize = Math.min(
    Math.max(1, input.pageSize ?? DEFAULT_API_PAGE_SIZE),
    MAX_API_PAGE_SIZE,
  );
  return {
    page,
    pageSize,
    sort: input.sort,
    direction: input.direction ?? "desc",
  };
}

export function toPaginateOptions(
  input: ApiPageRequest,
  defaultSortBy: string,
): PaginateOptions {
  const normalized = normalizePageRequest(input);
  return {
    page: normalized.page,
    pageSize: normalized.pageSize,
    sortBy: normalized.sort ?? defaultSortBy,
    sortDirection: normalized.direction,
  };
}

/** Slice an in-memory candidate array into a PaginatedResult (max-candidate flows). */
export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(Math.max(1, pageSize), MAX_API_PAGE_SIZE);
  const total = items.length;
  const from = (safePage - 1) * safeSize;
  return {
    items: items.slice(from, from + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / safeSize),
  };
}
