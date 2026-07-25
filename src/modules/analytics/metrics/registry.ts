import { arrMetric } from "@/modules/analytics/metrics/arr.metric";
import { arpuMetric } from "@/modules/analytics/metrics/arpu.metric";
import { churnMetric } from "@/modules/analytics/metrics/churn.metric";
import { ltvMetric } from "@/modules/analytics/metrics/ltv.metric";
import { mrrMetric } from "@/modules/analytics/metrics/mrr.metric";
import { retentionMetric } from "@/modules/analytics/metrics/retention.metric";
import { revenueMetric } from "@/modules/analytics/metrics/revenue.metric";
import { subscriptionsMetric } from "@/modules/analytics/metrics/subscriptions.metric";
import { trialConversionMetric } from "@/modules/analytics/metrics/trial-conversion.metric";
import type {
  MetricDefinition,
  MetricId,
} from "@/modules/analytics/metrics/types";

export const METRIC_REGISTRY: Record<MetricId, MetricDefinition> = {
  mrr: mrrMetric,
  arr: arrMetric,
  churn: churnMetric,
  ltv: ltvMetric,
  arpu: arpuMetric,
  trial_conversion: trialConversionMetric,
  retention: retentionMetric,
  revenue: revenueMetric,
  subscriptions: subscriptionsMetric,
};

export function getMetric(id: MetricId): MetricDefinition {
  return METRIC_REGISTRY[id];
}

export function listMetrics(): MetricDefinition[] {
  return Object.values(METRIC_REGISTRY);
}
