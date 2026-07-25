/**
 * @deprecated Prefer `@/modules/analytics` DTOs.
 * Kept for transitional imports from docs / older code.
 */
export type {
  AnalyticsOverview,
  CountryAnalyticsResponse,
} from "@/modules/analytics/dto/responses";

export type { IAnalyticsService } from "@/modules/analytics/service/analytics.service";

/** Legacy DimensionSummary shape used by Phase 8 overview. */
export type DimensionSummary = {
  dimension: string;
  total: number;
  note: string;
};

/** Legacy RevenueSummary shape used by Phase 8 overview. */
export type RevenueSummary = {
  revenueCents: number;
  currency: string | null;
  note: string;
};
