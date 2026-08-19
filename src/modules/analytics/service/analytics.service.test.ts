import { describe, expect, it, vi } from "vitest";

import { AnalyticsService } from "@/modules/analytics/service/analytics.service";
import type { AnalyticsRepository } from "@/modules/analytics/repository/analytics.repository";
import type { DailyMetricsRepository } from "@/modules/analytics/repository/daily-metrics.repository";
import type { SubscriptionMetricsRepository } from "@/modules/analytics/repository/subscription-metrics.repository";
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
      refreshed_at: new Date().toISOString(),
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

function mockDailyRepo(
  overrides: Partial<DailyMetricsRepository> = {},
): DailyMetricsRepository {
  return {
    buildForDate: vi.fn().mockResolvedValue(undefined),
    earliestMetricsDate: vi.fn().mockResolvedValue("2026-01-01"),
    listSubscriptionMetrics: vi.fn().mockResolvedValue([
      {
        date: "2026-07-01",
        new_subscriptions: 2,
        renewals: 1,
        cancellations: 1,
        expirations: 0,
        paused: 0,
        resumed: 0,
        active_subscriptions: 10,
        net_growth: 1,
        churn_rate: 9.09,
        built_at: "2026-07-25T00:00:00Z",
      },
    ]),
    listTrialMetrics: vi.fn().mockResolvedValue([]),
    listPaymentMetrics: vi.fn().mockResolvedValue([
      {
        date: "2026-07-01",
        successful_payments: 3,
        failed_payments: 1,
        recovered_payments: 0,
        payment_success_rate: 75,
        revenue_cents: 900,
        built_at: "2026-07-25T00:00:00Z",
      },
    ]),
    listCustomerMetrics: vi.fn().mockResolvedValue([]),
    listProductMetrics: vi.fn().mockResolvedValue([]),
    listCountryMetrics: vi.fn().mockResolvedValue([]),
    listPlatformMetrics: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as DailyMetricsRepository;
}

function mockSubscriptionMetricsRepo(
  overrides: Partial<SubscriptionMetricsRepository> = {},
): SubscriptionMetricsRepository {
  return {
    listMetrics: vi.fn().mockResolvedValue([
      {
        report_date: "2026-07-20",
        platform: "Web",
        country: "US",
        product_id: "11111111-1111-1111-1111-111111111111",
        subscription_gain: 2,
        subscription_loss: 1,
        trial_gain: 3,
        trial_loss: 1,
        trial_conversion: 1,
        combined_gain: 5,
        combined_loss: 2,
        unique_customers_gain: 4,
        unique_customers_loss: 2,
      },
    ]),
    listMetricsGrouped: vi.fn().mockResolvedValue({
      byDay: [
        {
          report_date: "2026-07-20",
          platform: "",
          country: "",
          product_id: "",
          subscription_gain: 2,
          subscription_loss: 1,
          trial_gain: 3,
          trial_loss: 1,
          trial_conversion: 1,
          combined_gain: 5,
          combined_loss: 2,
          unique_customers_gain: 4,
          unique_customers_loss: 2,
        },
      ],
      byPlatform: [
        {
          report_date: "",
          platform: "Web",
          country: "",
          product_id: "",
          subscription_gain: 2,
          subscription_loss: 1,
          trial_gain: 3,
          trial_loss: 1,
          trial_conversion: 1,
          combined_gain: 5,
          combined_loss: 2,
          unique_customers_gain: 4,
          unique_customers_loss: 2,
        },
      ],
      byCountry: [],
      byProduct: [],
    }),
    listDayCountryMetrics: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SubscriptionMetricsRepository;
}

const logger = new Logger({ service: "test" });

function createService(
  repo = mockRepo(),
  daily = mockDailyRepo(),
  subMetrics = mockSubscriptionMetricsRepo(),
) {
  return new AnalyticsService(repo, daily, subMetrics, logger);
}

describe("AnalyticsService", () => {
  it("returns dashboard KPIs from repository", async () => {
    const service = createService();
    const dashboard = await service.getDashboard();
    expect(dashboard.activeSubscribers).toBe(4);
    expect(dashboard.mrrCents).toBe(100);
  });

  it("auto-refreshes dashboard when snapshot is from a prior UTC day", async () => {
    const repo = mockRepo({
      getDashboard: vi
        .fn()
        .mockResolvedValueOnce({
          id: 1,
          total_customers: 10,
          new_customers_today: 0,
          active_subscribers: 4,
          paused_subscriptions: 0,
          cancelled_subscriptions: 1,
          expired_subscriptions: 0,
          free_trial_subscriptions: 2,
          renewals_today: 0,
          cancelled_today: 0,
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
          refreshed_at: "2026-08-17T11:23:14.000Z",
        })
        .mockResolvedValueOnce({
          id: 1,
          total_customers: 10,
          new_customers_today: 12,
          active_subscribers: 4,
          paused_subscriptions: 0,
          cancelled_subscriptions: 1,
          expired_subscriptions: 0,
          free_trial_subscriptions: 2,
          renewals_today: 3,
          cancelled_today: 1,
          charge_failures: 0,
          recovered_payments: 0,
          revenue_today_cents: 2500,
          revenue_week_cents: 2500,
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
          refreshed_at: new Date().toISOString(),
        }),
    });
    const service = createService(repo);
    const dashboard = await service.getDashboard();
    expect(repo.refresh).toHaveBeenCalledWith("dashboard");
    expect(dashboard.newCustomersToday).toBe(12);
    expect(dashboard.cancelledToday).toBe(1);
  });

  it("builds Phase 8 compatible overview", async () => {
    const service = createService();
    const overview = await service.getOverview();
    expect(overview.activeSubscribers).toBe(4);
    expect(overview.revenue.revenueCents).toBe(500);
  });

  it("refresh delegates to repository", async () => {
    const repo = mockRepo();
    const service = createService(repo);
    const result = await service.refresh("dashboard");
    expect(repo.refresh).toHaveBeenCalledWith("dashboard");
    expect(result.ok).toBe(true);
  });

  it("uses daily snapshots when date range is provided", async () => {
    const daily = mockDailyRepo();
    const service = createService(mockRepo(), daily);
    const data = await service.getSubscriptionAnalytics({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01",
    });
    expect(daily.listSubscriptionMetrics).toHaveBeenCalled();
    expect(data.open).toBe(10);
    expect(data.cancelled).toBe(1);
  });

  it("uses daily payment snapshots for historical revenue", async () => {
    const daily = mockDailyRepo();
    const service = createService(mockRepo(), daily);
    const data = await service.getRevenue({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01",
    });
    expect(daily.listPaymentMetrics).toHaveBeenCalled();
    expect(data.totalRevenueCents).toBe(900);
  });

  it("returns subscription gain/loss metrics from subscription_events RPC", async () => {
    const subMetrics = mockSubscriptionMetricsRepo();
    const service = createService(mockRepo(), mockDailyRepo(), subMetrics);
    const data = await service.getSubscriptionGainLossMetrics({
      preset: "yesterday",
      groupBy: "day",
    });
    expect(subMetrics.listMetricsGrouped).toHaveBeenCalled();
    expect(data.source).toBe("subscription_events");
    expect(data.totals.subscriptionGain).toBe(2);
    expect(data.totals.trialGain).toBe(3);
    expect(data.byPlatform.some((r) => r.key === "TOTAL")).toBe(true);
  });

  it("falls back to mv_daily_metrics when daily snapshots are empty", async () => {
    const repo = mockRepo({
      getDailyMetrics: vi.fn().mockResolvedValue([
        {
          metric_date: "2026-08-01",
          new_customers: 5,
          new_subscriptions: 3,
          new_trials: 1,
          cancellations: 1,
          payment_attempts: 4,
          successful_payments: 3,
          failed_payments: 1,
          revenue_cents: 1200,
          refreshed_at: "2026-08-19T00:00:00Z",
        },
      ]),
    });
    const daily = mockDailyRepo({
      listSubscriptionMetrics: vi.fn().mockResolvedValue([]),
      listPaymentMetrics: vi.fn().mockResolvedValue([]),
      listCustomerMetrics: vi.fn().mockResolvedValue([]),
      listTrialMetrics: vi.fn().mockResolvedValue([]),
    });
    const service = createService(repo, daily);
    const data = await service.getDailyAnalytics();
    expect(repo.getDailyMetrics).toHaveBeenCalled();
    expect(data.source).toBe("mv_daily_metrics");
    expect(data.customers[0]?.newCustomers).toBe(5);
    expect(data.payments[0]?.revenueCents).toBe(1200);
    expect(data.subscriptions[0]?.netGrowth).toBe(2);
  });
});
