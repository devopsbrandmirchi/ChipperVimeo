import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const mrrMetric: MetricDefinition = {
  id: "mrr",
  name: "Monthly Recurring Revenue",
  description: "Proxy MRR from open subscriptions (yearly price / 12).",
  unit: "cents",
  formula:
    "SUM(open monthly price_cents + yearly price_cents/12) from analytics.vw_subscription_mrr_cents",
  source: { view: "analytics.mv_dashboard", column: "mrr_cents" },
  filters: ["productId", "country", "platform", "billingCycle"],
};
