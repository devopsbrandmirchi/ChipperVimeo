/**
 * Thin controller helpers for App Router analytics endpoints.
 * No business logic — parse + call service + envelope.
 */

import type { NextRequest } from "next/server";

import {
  analyticsFiltersSchema,
  buildDailyAnalyticsSchema,
  refreshAnalyticsSchema,
  subscriptionMetricsFiltersSchema,
} from "@/modules/analytics/dto/filters";
import type { IAnalyticsService } from "@/modules/analytics/service/analytics.service";

export function parseAnalyticsFilters(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  return analyticsFiltersSchema.parse(raw);
}

export function parseSubscriptionMetricsFilters(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  return subscriptionMetricsFiltersSchema.parse(raw);
}

export async function parseRefreshBody(request: NextRequest) {
  const body: unknown = await request.json().catch(() => ({}));
  return refreshAnalyticsSchema.parse(body ?? {});
}

export async function parseBuildDailyBody(request: NextRequest) {
  const body: unknown = await request.json().catch(() => ({}));
  return buildDailyAnalyticsSchema.parse(body ?? {});
}

export type AnalyticsController = {
  service: IAnalyticsService;
};
