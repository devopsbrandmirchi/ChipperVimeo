"use client";

import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";

/**
 * Stays mounted outside Suspense so preset buttons update immediately
 * while gain/loss metrics stream in.
 */
export function GainLossToolbar({
  preset,
  startDate,
  endDate,
}: {
  preset: string;
  startDate: string;
  endDate: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Subscription &amp; trial gain / loss
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {startDate} → {endDate} (UTC) · source: subscription_events
        </p>
      </div>
      <DateRangeFilter
        preset={preset}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
