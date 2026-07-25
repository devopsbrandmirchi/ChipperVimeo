import { NextResponse } from "next/server";

import {
  buildError,
  buildSuccess,
  type ApiErrorDetail,
  type BaseApiResponse,
  type PaginationMeta,
} from "@/types/api-response";

export function successResponse<T>(
  data: T,
  message: string,
  options?: { meta?: PaginationMeta; status?: number; requestId?: string },
): NextResponse<BaseApiResponse<T>> {
  const body = buildSuccess(data, message, options?.meta);
  const res = NextResponse.json(body, { status: options?.status ?? 200 });
  if (options?.requestId) {
    res.headers.set("x-request-id", options.requestId);
  }
  return res;
}

export function errorResponse(
  message: string,
  status: number,
  options?: { errors?: ApiErrorDetail[]; requestId?: string },
): NextResponse<BaseApiResponse<never>> {
  const body = buildError(message, options?.errors);
  const res = NextResponse.json(body, { status });
  if (options?.requestId) {
    res.headers.set("x-request-id", options.requestId);
  }
  return res;
}
