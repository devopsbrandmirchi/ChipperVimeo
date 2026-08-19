import type {
  ChurnAnalyticsResponse,
  SubscriptionGainLossTotals,
  SubscriptionMetricsResponse,
  TrialAnalyticsResponse,
} from "@/modules/analytics/dto/responses";

export type SubscriptionHealthPeriod = {
  startDate: string;
  endDate: string;
  subscriptionGain: number;
  subscriptionLoss: number;
  netSubscriptionGrowth: number;
  /** subscriptionLoss / (gain + loss) × 100 when turnover > 0 */
  periodChurnSharePct: number;
  /** 100 − periodChurnSharePct */
  periodRetentionSharePct: number;
  /** subscriptionLoss / subscriptionGain × 100 when gain > 0 */
  lossToGainPct: number | null;
  trialStarted: number;
  trialConverted: number;
  trialExpired: number;
  trialConversionRatePct: number;
  /** trialExpired / trialStarted × 100 when started > 0 */
  trialExpirationRatePct: number;
};

export type SubscriptionHealthStock = {
  churnRatePct: number;
  retentionRatePct: number;
  cancelledThisMonth: number;
  retainedOpen: number;
  activeTrials: number;
  trialsExpiringSoon: number;
  stockTrialConversionPct: number;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function deriveSubscriptionHealthPeriod(
  metrics: Pick<SubscriptionMetricsResponse, "startDate" | "endDate" | "totals">,
): SubscriptionHealthPeriod {
  const t: SubscriptionGainLossTotals = metrics.totals;
  const turnover = t.subscriptionGain + t.subscriptionLoss;
  const churnShare = pct(t.subscriptionLoss, turnover);

  return {
    startDate: metrics.startDate,
    endDate: metrics.endDate,
    subscriptionGain: t.subscriptionGain,
    subscriptionLoss: t.subscriptionLoss,
    netSubscriptionGrowth: t.subscriptionGain - t.subscriptionLoss,
    periodChurnSharePct: churnShare,
    periodRetentionSharePct: turnover > 0 ? Number((100 - churnShare).toFixed(2)) : 0,
    lossToGainPct:
      t.subscriptionGain > 0 ? pct(t.subscriptionLoss, t.subscriptionGain) : null,
    trialStarted: t.trialGain,
    trialConverted: t.trialConversion,
    trialExpired: t.trialLoss,
    trialConversionRatePct: t.conversionRate,
    trialExpirationRatePct: pct(t.trialLoss, t.trialGain),
  };
}

export function mapSubscriptionHealthStock(
  churn: ChurnAnalyticsResponse | null,
  trials: TrialAnalyticsResponse | null,
): SubscriptionHealthStock | null {
  if (!churn && !trials) return null;
  return {
    churnRatePct: churn?.churnRatePct ?? 0,
    retentionRatePct: churn?.retentionRatePct ?? 0,
    cancelledThisMonth: churn?.cancelledThisMonth ?? 0,
    retainedOpen: churn?.retainedOpen ?? 0,
    activeTrials: trials?.activeTrials ?? 0,
    trialsExpiringSoon: trials?.trialsExpiringSoon ?? 0,
    stockTrialConversionPct: trials?.trialConversionPct ?? 0,
  };
}
