"use client";

import { MetricCard, StatCard } from "@/components/cards/MetricCard";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { cn } from "@/lib/utils";
import type { SubscriptionMetricsResponse } from "@/modules/analytics/dto/responses";

function fmt(n: number): string {
  return n.toLocaleString();
}

export function GainLossMetrics({
  data,
  preset,
}: {
  data: SubscriptionMetricsResponse;
  preset: string;
}) {
  const t = data.totals;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Subscription &amp; trial gain / loss
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {data.startDate} → {data.endDate} (UTC) · source: {data.source}
          </p>
        </div>
        <DateRangeFilter
          preset={preset}
          startDate={data.startDate}
          endDate={data.endDate}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Combined Gain"
          value={fmt(t.combinedGain)}
          hint="Subscription Gain + Trial Gain"
        />
        <MetricCard
          title="Combined Loss"
          value={fmt(t.combinedLoss)}
          hint="Subscription Loss + Trial Loss"
        />
        <MetricCard
          title="Subscription Gain"
          value={fmt(t.subscriptionGain)}
          hint="Paid created + trial converted"
        />
        <MetricCard
          title="Subscription Loss"
          value={fmt(t.subscriptionLoss)}
          hint="Web: set_cancellation · Non-web: cancelled/expired/disabled"
        />
        <MetricCard
          title="Trial Gain"
          value={fmt(t.trialGain)}
          hint="trial_started"
        />
        <MetricCard
          title="Trial Loss"
          value={fmt(t.trialLoss)}
          hint="trial_expired"
        />
        <MetricCard
          title="Trial Conversion"
          value={fmt(t.trialConversion)}
          hint={`Rate ${t.conversionRate}%`}
        />
      </div>

      <DailyGainLossTable rows={data.series} totals={t} />

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownTable
          title="By platform"
          rows={data.byPlatform}
          labelHeader="Platform"
        />
        <BreakdownTable
          title="By country"
          rows={data.byCountry}
          labelHeader="Country"
        />
        <BreakdownTable
          title="By product"
          rows={data.byProduct}
          labelHeader="Product"
          showConversion
        />
      </div>
    </section>
  );
}

function DailyGainLossTable({
  rows,
  totals,
}: {
  rows: SubscriptionMetricsResponse["series"];
  totals: SubscriptionMetricsResponse["totals"];
}) {
  const days = [...rows].sort((a, b) => b.key.localeCompare(a.key));

  return (
    <StatCard title="Day-wise gain / loss (UTC)">
      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 bg-[var(--card)] text-[var(--muted-foreground)]">
            <tr>
              <th className="py-2 pr-3 font-medium" rowSpan={2}>
                Date
              </th>
              <th
                className="border-b border-[var(--border)] py-2 pr-3 text-center font-medium"
                colSpan={2}
              >
                Combined
              </th>
              <th
                className="border-b border-[var(--border)] py-2 pr-3 text-center font-medium"
                colSpan={2}
              >
                Subscription
              </th>
              <th
                className="border-b border-[var(--border)] py-2 text-center font-medium"
                colSpan={2}
              >
                Trial
              </th>
            </tr>
            <tr>
              <th className="py-2 pr-3 font-medium">Gain</th>
              <th className="py-2 pr-3 font-medium">Loss</th>
              <th className="py-2 pr-3 font-medium">Gain</th>
              <th className="py-2 pr-3 font-medium">Loss</th>
              <th className="py-2 pr-3 font-medium">Gain</th>
              <th className="py-2 font-medium">Loss</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-3 text-[var(--muted-foreground)]"
                >
                  No events in range
                </td>
              </tr>
            ) : (
              days.map((row) => (
                <tr
                  key={row.key}
                  className="border-t border-[var(--border)]"
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {row.reportDate ?? row.label}
                  </td>
                  <td className="py-2 pr-3">{fmt(row.combinedGain)}</td>
                  <td className="py-2 pr-3">{fmt(row.combinedLoss)}</td>
                  <td className="py-2 pr-3">{fmt(row.subscriptionGain)}</td>
                  <td className="py-2 pr-3">{fmt(row.subscriptionLoss)}</td>
                  <td className="py-2 pr-3">{fmt(row.trialGain)}</td>
                  <td className="py-2">{fmt(row.trialLoss)}</td>
                </tr>
              ))
            )}
            <tr className="border-t-2 border-[var(--border)] font-semibold">
              <td className="py-2 pr-3">TOTAL</td>
              <td className="py-2 pr-3">{fmt(totals.combinedGain)}</td>
              <td className="py-2 pr-3">{fmt(totals.combinedLoss)}</td>
              <td className="py-2 pr-3">{fmt(totals.subscriptionGain)}</td>
              <td className="py-2 pr-3">{fmt(totals.subscriptionLoss)}</td>
              <td className="py-2 pr-3">{fmt(totals.trialGain)}</td>
              <td className="py-2">{fmt(totals.trialLoss)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Combined = Subscription + Trial. Gain/Loss from{" "}
        <code>subscription_events</code> (UTC). Loss rules: Web ={" "}
        <code>set_cancellation</code>; non-Web ={" "}
        <code>cancelled</code>/<code>expired</code>/<code>disabled</code>; Trial
        = <code>trial_expired</code>.
      </p>
    </StatCard>
  );
}

type BreakdownRow = SubscriptionMetricsResponse["byPlatform"][number];

function BreakdownTable({
  title,
  rows,
  labelHeader,
  showConversion,
}: {
  title: string;
  rows: BreakdownRow[];
  labelHeader: string;
  showConversion?: boolean;
}) {
  return (
    <StatCard title={title}>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[var(--card)] text-[var(--muted-foreground)]">
            <tr>
              <th className="py-2 pr-2 font-medium">{labelHeader}</th>
              <th className="py-2 pr-2 font-medium">Gain</th>
              <th className="py-2 pr-2 font-medium">Loss</th>
              {showConversion ? (
                <th className="py-2 font-medium">Conv%</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={showConversion ? 4 : 3}
                  className="py-3 text-[var(--muted-foreground)]"
                >
                  No events in range
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-t border-[var(--border)]",
                    row.key === "TOTAL" && "font-semibold",
                  )}
                >
                  <td className="py-2 pr-2">{row.label}</td>
                  <td className="py-2 pr-2">{fmt(row.combinedGain)}</td>
                  <td className="py-2 pr-2">{fmt(row.combinedLoss)}</td>
                  {showConversion ? (
                    <td className="py-2">{row.conversionRate}%</td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StatCard>
  );
}
