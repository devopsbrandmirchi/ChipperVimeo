import type { BaseApiResponse, PaginationMeta } from "@/lib/api/types";
import { ApiClientError } from "@/lib/api/errors";

export type ApiResult<T> = {
  data: T;
  meta?: PaginationMeta;
  message: string;
};

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  let body: BaseApiResponse<T>;
  try {
    body = (await response.json()) as BaseApiResponse<T>;
  } catch {
    throw new ApiClientError(
      response.ok ? "Invalid JSON response" : response.statusText || "Request failed",
      response.status || 500,
    );
  }

  if (!response.ok || !body.success) {
    const detail = body.errors?.[0];
    throw new ApiClientError(
      detail?.message ?? body.message ?? "Request failed",
      response.status,
      detail?.code,
    );
  }

  if (body.data === undefined) {
    throw new ApiClientError(body.message || "Empty response", response.status || 500);
  }

  return {
    data: body.data,
    meta: body.meta,
    message: body.message,
  };
}

export async function apiGetClient<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<ApiResult<T>> {
  const response = await fetch(`/api/v1${path}${buildQuery(params)}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return parseResponse<T>(response);
}

export { buildQuery, parseResponse };
