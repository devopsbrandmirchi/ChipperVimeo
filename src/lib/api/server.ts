import { cookies, headers } from "next/headers";

import { buildQuery, parseResponse, type ApiResult } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/errors";

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) {
    throw new ApiClientError("Unable to resolve app URL for server fetch", 500);
  }
  return `${proto}://${host}`;
}

export async function apiGetServer<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<ApiResult<T>> {
  const baseUrl = await resolveBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(`${baseUrl}/api/v1${path}${buildQuery(params)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    cache: "no-store",
  });

  return parseResponse<T>(response);
}
