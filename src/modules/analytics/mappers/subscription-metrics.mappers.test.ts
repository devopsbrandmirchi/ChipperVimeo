import { describe, expect, it } from "vitest";

import {
  mapSubscriptionMetricsResponse,
  resolveSubscriptionMetricsRange,
  utcToday,
} from "@/modules/analytics/mappers/subscription-metrics.mappers";
import type {
  SubscriptionMetricsDbRow,
  SubscriptionMetricsDayCountryDbRow,
} from "@/modules/analytics/repository/subscription-metrics.repository";
import { isFreeTrialCustomer } from "@/processors/helpers/payload";
import type { VimeoCustomer } from "@/types/vimeo";

function row(
  partial: Partial<SubscriptionMetricsDbRow> &
    Pick<SubscriptionMetricsDbRow, "report_date" | "platform">,
): SubscriptionMetricsDbRow {
  return {
    country: "US",
    product_id: "11111111-1111-1111-1111-111111111111",
    subscription_gain: 0,
    subscription_loss: 0,
    trial_gain: 0,
    trial_loss: 0,
    trial_conversion: 0,
    combined_gain: 0,
    combined_loss: 0,
    unique_customers_gain: 0,
    unique_customers_loss: 0,
    ...partial,
  };
}

describe("resolveSubscriptionMetricsRange", () => {
  it("resolves last7 as inclusive 7 UTC days ending today", () => {
    const range = resolveSubscriptionMetricsRange({
      preset: "last7",
      groupBy: "day",
    });
    const start = new Date(`${range.startDate}T00:00:00.000Z`);
    const end = new Date(`${range.endDate}T00:00:00.000Z`);
    const days =
      Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    expect(days).toBe(7);
    expect(range.preset).toBe("last7");
  });

  it("uses custom dates when provided", () => {
    const range = resolveSubscriptionMetricsRange({
      preset: "custom",
      startDate: "2026-07-01",
      endDate: "2026-07-10",
      groupBy: "day",
    });
    expect(range).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-10",
      preset: "custom",
    });
  });

  it("swaps inverted custom dates", () => {
    const range = resolveSubscriptionMetricsRange({
      preset: "custom",
      startDate: "2026-07-10",
      endDate: "2026-07-01",
      groupBy: "day",
    });
    expect(range.startDate).toBe("2026-07-01");
    expect(range.endDate).toBe("2026-07-10");
  });
});

describe("mapSubscriptionMetricsResponse", () => {
  it("aggregates gain/loss totals and includes platform TOTAL", () => {
    const rows: SubscriptionMetricsDbRow[] = [
      row({
        report_date: "2026-07-20",
        platform: "Web",
        subscription_gain: 2,
        trial_gain: 3,
        trial_conversion: 1,
        subscription_loss: 1,
        trial_loss: 0,
        combined_gain: 5,
        combined_loss: 1,
      }),
      row({
        report_date: "2026-07-20",
        platform: "iOS",
        subscription_gain: 1,
        trial_gain: 0,
        trial_conversion: 0,
        subscription_loss: 2,
        trial_loss: 1,
        combined_gain: 1,
        combined_loss: 3,
      }),
    ];

    const result = mapSubscriptionMetricsResponse(
      rows,
      [],
      {
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        preset: "today",
      },
    );

    expect(result.source).toBe("subscription_events");
    expect(result.totals.subscriptionGain).toBe(3);
    expect(result.totals.trialGain).toBe(3);
    expect(result.totals.trialConversion).toBe(1);
    expect(result.totals.subscriptionLoss).toBe(3);
    expect(result.totals.trialLoss).toBe(1);
    expect(result.totals.combinedGain).toBe(6);
    expect(result.totals.combinedLoss).toBe(4);
    // conversion = trialConversion / trialGain
    expect(result.totals.conversionRate).toBe(33.33);
    expect(result.byPlatform.some((r) => r.key === "TOTAL")).toBe(true);
    expect(result.byPlatform.find((r) => r.key === "TOTAL")?.subscriptionGain).toBe(
      3,
    );
  });

  it("does not invent paid gain from trial-only rows", () => {
    const rows = [
      row({
        report_date: "2026-07-21",
        platform: "Web",
        trial_gain: 5,
        subscription_gain: 0,
        trial_conversion: 0,
        combined_gain: 5,
      }),
    ];
    const result = mapSubscriptionMetricsResponse(
      rows,
      [],
      {
        startDate: "2026-07-21",
        endDate: "2026-07-21",
        preset: "today",
      },
    );
    expect(result.totals.subscriptionGain).toBe(0);
    expect(result.totals.trialGain).toBe(5);
  });

  it("maps byDayCountry using pre-aggregated distinct counts", () => {
    const dayCountryRows: SubscriptionMetricsDayCountryDbRow[] = [
      {
        report_date: "2026-07-21",
        country: "US",
        subscription_gain: 2,
        subscription_loss: 1,
        trial_gain: 1,
        trial_loss: 0,
        trial_conversion: 1,
        combined_gain: 3,
        combined_loss: 1,
        unique_customers_gain: 5,
        unique_customers_loss: 2,
      },
      {
        report_date: "2026-07-21",
        country: "CA",
        subscription_gain: 0,
        subscription_loss: 0,
        trial_gain: 2,
        trial_loss: 1,
        trial_conversion: 1,
        combined_gain: 2,
        combined_loss: 1,
        unique_customers_gain: 3,
        unique_customers_loss: 4,
      },
    ];

    const result = mapSubscriptionMetricsResponse(
      [],
      dayCountryRows,
      {
        startDate: "2026-07-21",
        endDate: "2026-07-21",
        preset: "custom",
      },
    );

    expect(result.byDayCountry).toHaveLength(2);
    // US should come before CA because it has higher unique_customers_gain
    expect(result.byDayCountry[0].country).toBe("US");
    expect(result.byDayCountry[0].uniqueCustomersGain).toBe(5);
    expect(result.byDayCountry[1].country).toBe("CA");
    expect(result.byDayCountry[1].uniqueCustomersLoss).toBe(4);
  });

  it("orders byDayCountry by latest date first and drops today UTC", () => {
    const today = utcToday();
    const yesterday = new Date(`${today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const older = new Date(`${today}T00:00:00.000Z`);
    older.setUTCDate(older.getUTCDate() - 2);
    const olderStr = older.toISOString().slice(0, 10);

    const dayCountryRows: SubscriptionMetricsDayCountryDbRow[] = [
      {
        report_date: olderStr,
        country: "US",
        subscription_gain: 1,
        subscription_loss: 0,
        trial_gain: 0,
        trial_loss: 0,
        trial_conversion: 0,
        combined_gain: 1,
        combined_loss: 0,
        unique_customers_gain: 1,
        unique_customers_loss: 0,
      },
      {
        report_date: yesterdayStr,
        country: "US",
        subscription_gain: 2,
        subscription_loss: 0,
        trial_gain: 0,
        trial_loss: 0,
        trial_conversion: 0,
        combined_gain: 2,
        combined_loss: 0,
        unique_customers_gain: 2,
        unique_customers_loss: 0,
      },
      {
        report_date: today,
        country: "US",
        subscription_gain: 9,
        subscription_loss: 0,
        trial_gain: 0,
        trial_loss: 0,
        trial_conversion: 0,
        combined_gain: 9,
        combined_loss: 0,
        unique_customers_gain: 9,
        unique_customers_loss: 0,
      },
    ];

    const result = mapSubscriptionMetricsResponse([], dayCountryRows, {
      startDate: olderStr,
      endDate: today,
      preset: "custom",
    });

    expect(result.byDayCountry).toHaveLength(2);
    expect(result.byDayCountry[0].reportDate).toBe(yesterdayStr);
    expect(result.byDayCountry[1].reportDate).toBe(olderStr);
    expect(result.byDayCountry.every((r) => r.reportDate !== today)).toBe(true);
  });
});

describe("isFreeTrialCustomer (paid-created rule)", () => {
  it("routes trial status to trial path (not paid created)", () => {
    expect(
      isFreeTrialCustomer({
        subscription_status: "free_trial",
      } as VimeoCustomer),
    ).toBe(true);
    expect(
      isFreeTrialCustomer({
        subscription_status: "active",
      } as VimeoCustomer),
    ).toBe(false);
  });
});
