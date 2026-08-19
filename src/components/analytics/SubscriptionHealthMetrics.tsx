import { MetricCard, StatCard } from "@/components/cards/MetricCard";
import { cn } from "@/lib/utils";
import {
  deriveSubscriptionHealthPeriod,
  type SubscriptionHealthStock,
} from "@/modules/analytics/mappers/subscription-health.mappers";
import type { SubscriptionMetricsResponse } from "@/modules/analytics/dto/responses";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number): string {
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function FunnelStep({
  label,
  value,
  rateLabel,
  widthPct,
}: {
  label: string;
  value: number;
  rateLabel?: string;
  widthPct: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-semibold tabular-nums">
          {fmt(value)}
          {rateLabel ? (
            <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
              {rateLabel}
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--foreground)]"
          style={{ width: `${Math.max(2, Math.min(100, widthPct))}%` }}
        />
      </div>
    </div>
  );
}

export function SubscriptionHealthMetrics({
  data,
  stock,
}: {
  data: SubscriptionMetricsResponse;
  stock?: SubscriptionHealthStock | null;
}) {
  const health = deriveSubscriptionHealthPeriod(data);
  const funnelBase = Math.max(
    health.trialStarted,
    health.trialConverted,
    health.trialExpired,
    1,
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Subscription health
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Period churn / retention and trial funnel for {health.startDate} →{" "}
          {health.endDate} (UTC) · derived from subscription_events gain/loss
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Net subscription growth"
          value={fmt(health.netSubscriptionGrowth)}
          hint="Subscription Gain − Subscription Loss"
        />
        <MetricCard
          title="Period churn share"
          value={fmtPct(health.periodChurnSharePct)}
          hint="Loss ÷ (Gain + Loss) in range"
        />
        <MetricCard
          title="Period retention share"
          value={fmtPct(health.periodRetentionSharePct)}
          hint="100 − period churn share"
        />
        <MetricCard
          title="Loss-to-gain"
          value={
            health.lossToGainPct === null ? "—" : fmtPct(health.lossToGainPct)
          }
          hint="Subscription Loss ÷ Subscription Gain"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatCard title="Trial funnel (period)">
          <div className="space-y-4">
            <FunnelStep
              label="Started"
              value={health.trialStarted}
              widthPct={(health.trialStarted / funnelBase) * 100}
            />
            <FunnelStep
              label="Converted"
              value={health.trialConverted}
              rateLabel={fmtPct(health.trialConversionRatePct)}
              widthPct={(health.trialConverted / funnelBase) * 100}
            />
            <FunnelStep
              label="Expired"
              value={health.trialExpired}
              rateLabel={fmtPct(health.trialExpirationRatePct)}
              widthPct={(health.trialExpired / funnelBase) * 100}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Conversion rate = converted ÷ started. Expiration rate = expired ÷
              started. Same definitions as gain/loss trial cards.
            </p>
          </div>
        </StatCard>

        <StatCard title="Stock context (current)">
          {stock ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <StockStat
                label="Stock churn rate"
                value={fmtPct(stock.churnRatePct)}
                hint="From analytics.mv_churn / dashboard"
              />
              <StockStat
                label="Stock retention"
                value={fmtPct(stock.retentionRatePct)}
                hint="Complement of stock churn"
              />
              <StockStat
                label="Cancelled this month"
                value={fmt(stock.cancelledThisMonth)}
              />
              <StockStat
                label="Retained open"
                value={fmt(stock.retainedOpen)}
              />
              <StockStat
                label="Active trials"
                value={fmt(stock.activeTrials)}
              />
              <StockStat
                label="Trials expiring ≤7d"
                value={fmt(stock.trialsExpiringSoon)}
              />
              <StockStat
                label="Stock trial conversion"
                value={fmtPct(stock.stockTrialConversionPct)}
                hint="Dashboard cohort proxy"
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              Stock churn / trial snapshot unavailable. Period funnel above still
              reflects the selected range.
            </p>
          )}
        </StatCard>
      </div>
    </section>
  );
}

function StockStat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-[var(--border)] px-3 py-2", className)}>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="text-[11px] text-[var(--muted-foreground)]">{hint}</p>
      ) : null}
    </div>
  );
}
