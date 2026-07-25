import { describe, expect, it } from "vitest";

import {
  hasHistoricalRange,
  mapDailySubscriptionSeries,
  mapDailyUmbrella,
} from "@/modules/analytics/mappers/daily.mappers";

describe("daily.mappers", () => {
  it("detects historical range filters", () => {
    expect(hasHistoricalRange({})).toBe(false);
    expect(hasHistoricalRange({ date: "2026-07-01" })).toBe(true);
    expect(hasHistoricalRange({ dateFrom: "2026-07-01" })).toBe(true);
  });

  it("rolls up subscription metrics and recomputes churn", () => {
    const mapped = mapDailySubscriptionSeries(
      [
        {
          date: "2026-07-01",
          new_subscriptions: 2,
          renewals: 0,
          cancellations: 1,
          expirations: 0,
          paused: 0,
          resumed: 0,
          active_subscriptions: 9,
          net_growth: 1,
          churn_rate: 10,
          built_at: null,
        },
        {
          date: "2026-07-02",
          new_subscriptions: 3,
          renewals: 1,
          cancellations: 1,
          expirations: 1,
          paused: 0,
          resumed: 0,
          active_subscriptions: 10,
          net_growth: 1,
          churn_rate: 9,
          built_at: null,
        },
      ],
      "day",
    );
    expect(mapped.source).toBe("daily_snapshots");
    expect(mapped.series).toHaveLength(2);
    expect(mapped.cancelled).toBe(2);
  });

  it("maps umbrella daily payload", () => {
    const payload = mapDailyUmbrella({
      subscriptions: [],
      trials: [],
      payments: [],
      customers: [
        {
          date: "2026-07-01",
          new_customers: 1,
          active_customers: 5,
          returning_customers: 2,
          built_at: null,
        },
      ],
    });
    expect(payload.source).toBe("daily_snapshots");
    expect(payload.customers[0]?.activeCustomers).toBe(5);
  });
});
