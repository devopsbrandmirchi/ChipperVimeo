import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const ltvMetric: MetricDefinition = {
  id: "ltv",
  name: "Customer Lifetime Value",
  description: "Average lifetime successful payment revenue per customer.",
  unit: "cents",
  formula: "AVG(sum successful payment amount_cents per customer)",
  source: { view: "analytics.mv_ltv_metrics", column: "avg_ltv_cents" },
  filters: ["country", "platform"],
};
