import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const retentionMetric: MetricDefinition = {
  id: "retention",
  name: "Retention Rate",
  description: "100 - churn rate at refresh.",
  unit: "percent",
  formula: "100 - churn_rate_pct",
  source: { view: "analytics.mv_dashboard", column: "retention_rate_pct" },
  filters: ["dateFrom", "dateTo"],
};
