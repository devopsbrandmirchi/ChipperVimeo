/**
 * Thin controller helpers for App Router analytics endpoints.
 * No business logic — parse + call service + envelope.
 */

import type { NextRequest } from "next/server";

import {
  analyticsFiltersSchema,
  refreshAnalyticsSchema,
} from "@/modules/analytics/dto/filters";
import type { IAnalyticsService } from "@/modules/analytics/service/analytics.service";

export function parseAnalyticsFilters(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  return analyticsFiltersSchema.parse(raw);
}

export async function parseRefreshBody(request: NextRequest) {
  const body: unknown = await request.json().catch(() => ({}));
  return refreshAnalyticsSchema.parse(body ?? {});
}

export type AnalyticsController = {
  service: IAnalyticsService;
};
