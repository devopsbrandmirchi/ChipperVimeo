import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const churnMetric: MetricDefinition = {
  id: "churn",
  name: "Churn Rate",
  description: "Cancelled / (active + cancelled) subscriptions at refresh.",
  unit: "percent",
  formula: "cancelled / (active_open + cancelled) * 100",
  source: { view: "analytics.mv_churn_metrics", column: "churn_rate_pct" },
  filters: ["dateFrom", "dateTo", "productId"],
};
