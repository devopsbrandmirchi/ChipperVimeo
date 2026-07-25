import { describe, expect, it } from "vitest";

import { analyticsFiltersSchema } from "@/modules/analytics/dto/filters";
import { mapDashboard } from "@/modules/analytics/mappers/analytics.mappers";
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
  });
});
