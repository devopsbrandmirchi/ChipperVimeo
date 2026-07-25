import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const revenueMetric: MetricDefinition = {
  id: "revenue",
  name: "Revenue",
  description: "Successful payment amount_cents totals (today/week/month/year + series).",
  unit: "cents",
  formula: "SUM(amount_cents) where payment status is successful",
  source: { view: "analytics.mv_dashboard", column: "revenue_month_cents" },
  filters: ["dateFrom", "dateTo", "country", "platform", "productId", "groupBy"],
};
