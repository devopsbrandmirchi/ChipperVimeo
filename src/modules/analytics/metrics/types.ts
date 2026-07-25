/**
 * Metrics Catalog — typed definitions only (no SQL / I/O).
 * Computed values live in analytics.mv_*; this describes them for services and docs.
 */

export type MetricUnit = "cents" | "count" | "ratio" | "percent" | "days";

export type MetricId =
  | "mrr"
  | "arr"
  | "churn"
  | "ltv"
  | "arpu"
  | "trial_conversion"
  | "retention"
  | "revenue"
  | "subscriptions";

export type MetricDefinition = {
  id: MetricId;
  name: string;
  description: string;
  unit: MetricUnit;
  formula: string;
  source: {
    view: string;
    column?: string;
  };
  filters: readonly string[];
};
