/** Shared pagination and search option types for the repository layer. */

export type SortDirection = "asc" | "desc";

export type PaginateOptions = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  filters?: Record<string, string | number | boolean | null | undefined>;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CustomerSearchOptions = {
  email?: string;
  name?: string;
  country?: string;
  platform?: string;
  status?: string;
  limit?: number;
};

export type ProductSearchOptions = {
  sku?: string;
  name?: string;
  limit?: number;
};

export type SubscriptionSearchOptions = {
  status?: string;
  billingFrequency?: string;
  productId?: string;
  customerId?: string;
  limit?: number;
};

export type DateRangeOptions = {
  from: string;
  to: string;
  limit?: number;
};
