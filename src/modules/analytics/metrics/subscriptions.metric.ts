import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const subscriptionsMetric: MetricDefinition = {
  id: "subscriptions",
  name: "Subscriptions",
  description: "Subscription counts by status and billing cycle.",
  unit: "count",
  formula: "COUNT(*) filtered by status / free_trial / billing_frequency",
  source: { view: "analytics.mv_subscription_metrics" },
  filters: ["status", "billingCycle", "productId"],
};
