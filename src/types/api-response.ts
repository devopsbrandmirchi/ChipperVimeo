/**
 * Framework-agnostic API response envelope.
 * Safe to relocate to a future `core/` package — no Next.js imports.
 */

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiErrorDetail = {
  code: string;
  message: string;
  path?: string;
};

export type BaseApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: ApiErrorDetail[];
};

export function buildSuccess<T>(
  data: T,
  message: string,
  meta?: PaginationMeta,
): BaseApiResponse<T> {
  return {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function buildError(
  message: string,
  errors?: ApiErrorDetail[],
): BaseApiResponse<never> {
  return {
    success: false,
    message,
    ...(errors && errors.length > 0 ? { errors } : {}),
  };
}

export function paginationMetaFrom(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
