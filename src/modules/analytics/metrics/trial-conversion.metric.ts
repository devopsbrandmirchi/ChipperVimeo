import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const trialConversionMetric: MetricDefinition = {
  id: "trial_conversion",
  name: "Trial Conversion Rate",
  description: "Share of trial subscriptions still active (proxy conversion).",
  unit: "percent",
  formula: "active_or_converted_trials / total_trials * 100",
  source: { view: "analytics.mv_dashboard", column: "trial_conversion_pct" },
  filters: ["productId", "dateFrom", "dateTo"],
};
