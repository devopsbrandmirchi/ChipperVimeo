import { describe, expect, it, vi } from "vitest";

import { AnalyticsService } from "@/modules/analytics/service/analytics.service";
import type { AnalyticsRepository } from "@/modules/analytics/repository/analytics.repository";
import { Logger } from "@/processors/logger/logger";

function mockRepo(
  overrides: Partial<AnalyticsRepository> = {},
): AnalyticsRepository {
  return {
    getDashboard: vi.fn().mockResolvedValue({
      id: 1,
      total_customers: 10,
      new_customers_today: 0,
      active_subscribers: 4,
      paused_subscriptions: 0,
      cancelled_subscriptions: 1,
      expired_subscriptions: 0,
      free_trial_subscriptions: 2,
      renewals_today: 0,
      charge_failures: 0,
      recovered_payments: 0,
      revenue_today_cents: 0,
      revenue_week_cents: 0,
      revenue_month_cents: 500,
      revenue_year_cents: 500,
      mrr_cents: 100,
      arr_cents: 1200,
      arpu_cents: 25,
      arppu_proxy_cents: 50,
      trial_conversion_pct: 50,
      churn_rate_pct: 5,
      retention_rate_pct: 95,
      payment_recovery_rate_pct: 0,
      refreshed_at: "2026-07-25T00:00:00Z",
    }),
    listCountryMetrics: vi.fn().mockResolvedValue([]),
    listPlatformMetrics: vi.fn().mockResolvedValue([]),
    getDailyMetrics: vi.fn().mockResolvedValue([]),
    getMonthlyMetrics: vi.fn().mockResolvedValue([]),
    getSubscriptionMetrics: vi.fn().mockResolvedValue(null),
    getPaymentMetrics: vi.fn().mockResolvedValue(null),
    getTrialMetrics: vi.fn().mockResolvedValue(null),
    getChurnMetrics: vi.fn().mockResolvedValue(null),
    getLtvMetrics: vi.fn().mockResolvedValue(null),
    listProductMetrics: vi.fn().mockResolvedValue([]),
    getTopLtvCustomers: vi.fn().mockResolvedValue([]),
    getCustomersInTrial: vi.fn().mockResolvedValue([]),
    getCustomersFailedPayments: vi.fn().mockResolvedValue([]),
    getRecentlyCancelledCustomers: vi.fn().mockResolvedValue([]),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AnalyticsRepository;
}

describe("AnalyticsService", () => {
  const logger = new Logger({ service: "test" });

  it("returns dashboard KPIs from repository", async () => {
    const service = new AnalyticsService(mockRepo(), logger);
    const dashboard = await service.getDashboard();
    expect(dashboard.activeSubscribers).toBe(4);
    expect(dashboard.mrrCents).toBe(100);
  });

  it("builds Phase 8 compatible overview", async () => {
    const service = new AnalyticsService(mockRepo(), logger);
    const overview = await service.getOverview();
    expect(overview.activeSubscribers).toBe(4);
    expect(overview.revenue.revenueCents).toBe(500);
  });

  it("refresh delegates to repository", async () => {
    const repo = mockRepo();
    const service = new AnalyticsService(repo, logger);
    const result = await service.refresh("dashboard");
    expect(repo.refresh).toHaveBeenCalledWith("dashboard");
    expect(result.ok).toBe(true);
  });
});
