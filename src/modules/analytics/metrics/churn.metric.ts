import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const churnMetric: MetricDefinition = {
  id: "churn",
  name: "Churn Rate",
  description:
    "Period churn: cancels(D) ÷ active paid subscribers EOD(D−1). Stock MV ratio is a proxy only.",
  unit: "percent",
  formula: "cancellations(D) / active_paid_eod(D-1) * 100",
  source: {
    view: "analytics.daily_subscription_metrics",
    column: "churn_rate",
  },
  filters: ["dateFrom", "dateTo", "productId"],
};
