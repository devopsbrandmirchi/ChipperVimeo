import { describe, expect, it } from "vitest";

import { analyticsFiltersSchema } from "@/modules/analytics/dto/filters";
import {
  isDashboardSnapshotStale,
  mapDashboard,
} from "@/modules/analytics/mappers/analytics.mappers";
import type { DashboardRow } from "@/modules/analytics/types/rows";

describe("analyticsFiltersSchema", () => {
  it("parses valid filters", () => {
    const parsed = analyticsFiltersSchema.parse({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      groupBy: "month",
      country: "US",
    });
    expect(parsed.groupBy).toBe("month");
    expect(parsed.country).toBe("US");
  });

  it("rejects invalid dates", () => {
    expect(() =>
      analyticsFiltersSchema.parse({ dateFrom: "01-01-2026" }),
    ).toThrow();
  });
});

describe("mapDashboard", () => {
  it("maps null to empty dashboard", () => {
    const d = mapDashboard(null);
    expect(d.totalCustomers).toBe(0);
    expect(d.mrrCents).toBe(0);
  });

  it("maps row fields", () => {
    const row: DashboardRow = {
      id: 1,
      total_customers: 10,
      new_customers_today: 1,
      active_subscribers: 5,
      paused_subscriptions: 0,
      cancelled_subscriptions: 2,
      expired_subscriptions: 1,
      free_trial_subscriptions: 3,
      renewals_today: 0,
      charge_failures: 0,
      recovered_payments: 0,
      revenue_today_cents: 100,
      revenue_week_cents: 200,
      revenue_month_cents: 300,
      revenue_year_cents: 400,
      mrr_cents: 1000,
      arr_cents: 12000,
      arpu_cents: 200,
      arppu_proxy_cents: 250,
      trial_conversion_pct: 40,
      churn_rate_pct: 10,
      retention_rate_pct: 90,
      payment_recovery_rate_pct: 0,
      refreshed_at: "2026-07-25T00:00:00Z",
    };
    const d = mapDashboard(row);
    expect(d.activeSubscribers).toBe(5);
    expect(d.arrCents).toBe(12000);
    expect(d.cancelledToday).toBe(0);
  });

  it("maps cancelled_today when present", () => {
    const d = mapDashboard({
      id: 1,
      total_customers: 1,
      new_customers_today: 0,
      active_subscribers: 1,
      paused_subscriptions: 0,
      cancelled_subscriptions: 0,
      expired_subscriptions: 0,
      free_trial_subscriptions: 0,
      renewals_today: 0,
      cancelled_today: 7,
      charge_failures: 0,
      recovered_payments: 0,
      revenue_today_cents: 0,
      revenue_week_cents: 0,
      revenue_month_cents: 0,
      revenue_year_cents: 0,
      mrr_cents: 0,
      arr_cents: 0,
      arpu_cents: 0,
      arppu_proxy_cents: 0,
      trial_conversion_pct: 0,
      churn_rate_pct: 0,
      retention_rate_pct: 0,
      payment_recovery_rate_pct: 0,
      refreshed_at: "2026-08-19T00:00:00Z",
    });
    expect(d.cancelledToday).toBe(7);
  });

  it("overlays live today KPI fields", () => {
    const d = mapDashboard(
      {
        id: 1,
        total_customers: 10,
        new_customers_today: 1,
        active_subscribers: 5,
        paused_subscriptions: 0,
        cancelled_subscriptions: 2,
        expired_subscriptions: 1,
        free_trial_subscriptions: 3,
        renewals_today: 0,
        cancelled_today: 0,
        charge_failures: 0,
        recovered_payments: 0,
        revenue_today_cents: 100,
        revenue_week_cents: 200,
        revenue_month_cents: 300,
        revenue_year_cents: 400,
        mrr_cents: 1000,
        arr_cents: 12000,
        arpu_cents: 200,
        arppu_proxy_cents: 250,
        trial_conversion_pct: 40,
        churn_rate_pct: 10,
        retention_rate_pct: 90,
        payment_recovery_rate_pct: 0,
        refreshed_at: "2026-08-19T00:00:00Z",
      },
      {
        new_customers_today: 42,
        renewals_today: 7,
        cancelled_today: 3,
        revenue_today_cents: 999,
        as_of: "2026-09-01T06:00:00Z",
      },
    );
    expect(d.todayLive).toBe(true);
    expect(d.newCustomersToday).toBe(42);
    expect(d.renewalsToday).toBe(7);
    expect(d.cancelledToday).toBe(3);
    expect(d.revenueTodayCents).toBe(999);
    expect(d.todayAsOf).toBe("2026-09-01T06:00:00Z");
    expect(d.mrrCents).toBe(1000);
    expect(d.refreshedAt).toBe("2026-08-19T00:00:00Z");
  });
});

describe("isDashboardSnapshotStale", () => {
  it("is stale when refreshed on a prior UTC day", () => {
    expect(
      isDashboardSnapshotStale(
        "2026-08-17T11:23:14.000Z",
        new Date("2026-08-19T06:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("is fresh within the same UTC day and max age", () => {
    expect(
      isDashboardSnapshotStale(
        "2026-08-19T05:00:00.000Z",
        new Date("2026-08-19T05:30:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is stale when older than max age on the same day", () => {
    expect(
      isDashboardSnapshotStale(
        "2026-08-19T03:00:00.000Z",
        new Date("2026-08-19T05:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
