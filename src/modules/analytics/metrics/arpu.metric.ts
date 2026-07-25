import type { MetricDefinition } from "@/modules/analytics/metrics/types";

export const arpuMetric: MetricDefinition = {
  id: "arpu",
  name: "Average Revenue Per User",
  description: "MRR / active subscribers (proxy).",
  unit: "cents",
  formula: "mrr_cents / active_subscribers",
  source: { view: "analytics.mv_dashboard", column: "arpu_cents" },
  filters: ["country", "platform", "productId"],
};
