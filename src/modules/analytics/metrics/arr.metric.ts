import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const arrMetric: MetricDefinition = {
  id: "arr",
  name: "Annual Recurring Revenue",
  description: "MRR × 12 (proxy).",
  unit: "cents",
  formula: "mrr_cents * 12",
  source: { view: "analytics.mv_dashboard", column: "arr_cents" },
  filters: ["productId", "country", "platform"],
};
