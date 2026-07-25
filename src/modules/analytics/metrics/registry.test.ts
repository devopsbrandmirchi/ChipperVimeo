import { describe, expect, it } from "vitest";

import {
  getMetric,
  listMetrics,
  METRIC_REGISTRY,
} from "@/modules/analytics/metrics";

describe("Metrics Catalog", () => {
  it("registers all planned metrics", () => {
    expect(Object.keys(METRIC_REGISTRY).sort()).toEqual(
      [
        "arr",
        "arpu",
        "churn",
        "ltv",
        "mrr",
        "retention",
        "revenue",
        "subscriptions",
        "trial_conversion",
      ].sort(),
    );
  });

  it("exposes required definition fields", () => {
    for (const metric of listMetrics()) {
      expect(metric.id).toBeTruthy();
      expect(metric.name).toBeTruthy();
      expect(metric.formula).toBeTruthy();
      expect(metric.source.view).toMatch(/^analytics\./);
      expect(metric.filters.length).toBeGreaterThan(0);
    }
  });

  it("resolves metrics by id", () => {
    expect(getMetric("mrr").unit).toBe("cents");
    expect(getMetric("churn").unit).toBe("percent");
  });
});
