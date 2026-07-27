"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MetricCard, StatCard } from "@/components/cards/MetricCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionMetricsResponse } from "@/modules/analytics/dto/responses";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7" },
  { id: "last30", label: "Last 30" },
] as const;

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
  const pathname = usePathname();
  const t = data.totals;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Subscription &amp; trial gain / loss
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {data.startDate} → {data.endDate} (UTC) · source:{" "}
            {data.source}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              asChild
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
            >
              <Link
                href={`${pathname}?preset=${p.id}`}
                className={cn(preset === p.id && "pointer-events-none")}
              >
                {p.label}
              </Link>
            </Button>
          ))}
        </div>
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
          hint="Web: set_cancellation · Store: cancelled/expired/disabled"
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
