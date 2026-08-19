import { describe, expect, it } from "vitest";

import {
  deriveSubscriptionHealthPeriod,
  mapSubscriptionHealthStock,
} from "@/modules/analytics/mappers/subscription-health.mappers";

describe("deriveSubscriptionHealthPeriod", () => {
  it("derives churn share, retention, and trial funnel from gain/loss totals", () => {
    const health = deriveSubscriptionHealthPeriod({
      startDate: "2026-08-18",
      endDate: "2026-08-18",
      totals: {
        subscriptionGain: 100,
        subscriptionLoss: 25,
        trialGain: 40,
        trialLoss: 10,
        trialConversion: 8,
        combinedGain: 140,
        combinedLoss: 35,
        uniqueCustomersGain: 0,
        uniqueCustomersLoss: 0,
        conversionRate: 20,
      },
    });

    expect(health.netSubscriptionGrowth).toBe(75);
    expect(health.periodChurnSharePct).toBe(20);
    expect(health.periodRetentionSharePct).toBe(80);
    expect(health.lossToGainPct).toBe(25);
    expect(health.trialStarted).toBe(40);
    expect(health.trialConverted).toBe(8);
    expect(health.trialExpired).toBe(10);
    expect(health.trialConversionRatePct).toBe(20);
    expect(health.trialExpirationRatePct).toBe(25);
  });

  it("handles zero turnover without NaN", () => {
    const health = deriveSubscriptionHealthPeriod({
      startDate: "2026-08-18",
      endDate: "2026-08-18",
      totals: {
        subscriptionGain: 0,
        subscriptionLoss: 0,
        trialGain: 0,
        trialLoss: 0,
        trialConversion: 0,
        combinedGain: 0,
        combinedLoss: 0,
        uniqueCustomersGain: 0,
        uniqueCustomersLoss: 0,
        conversionRate: 0,
      },
    });
    expect(health.periodChurnSharePct).toBe(0);
    expect(health.lossToGainPct).toBeNull();
    expect(health.trialExpirationRatePct).toBe(0);
  });
});

describe("mapSubscriptionHealthStock", () => {
  it("returns null when both sources missing", () => {
    expect(mapSubscriptionHealthStock(null, null)).toBeNull();
  });

  it("maps stock churn and trial fields", () => {
    const stock = mapSubscriptionHealthStock(
      {
        cancelledTotal: 100,
        cancelledThisMonth: 12,
        retainedOpen: 500,
        churnRatePct: 8.5,
        retentionRatePct: 91.5,
        refreshedAt: null,
      },
      {
        totalTrials: 200,
        activeTrials: 50,
        trialsExpiringSoon: 7,
        trialConversionsProxy: 0,
        trialConversionPct: 33,
        refreshedAt: null,
      },
    );
    expect(stock?.cancelledThisMonth).toBe(12);
    expect(stock?.activeTrials).toBe(50);
    expect(stock?.trialsExpiringSoon).toBe(7);
    expect(stock?.stockTrialConversionPct).toBe(33);
  });
});
