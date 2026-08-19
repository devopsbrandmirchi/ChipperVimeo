import { MetricCard } from "@/components/cards/MetricCard";
import { RefreshDashboardButton } from "@/components/dashboard/RefreshDashboardButton";
import { isDashboardSnapshotStale } from "@/modules/analytics/mappers/analytics.mappers";
import type { DashboardResponse } from "@/modules/analytics/dto/responses";

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function DashboardMetrics({
  dashboard,
}: {
  dashboard: DashboardResponse;
}) {
  const stale = isDashboardSnapshotStale(dashboard.refreshedAt);
  const refreshed = dashboard.refreshedAt
    ? `Snapshot as of ${formatUtc(dashboard.refreshedAt)}`
    : "Snapshot time unknown";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs text-[var(--muted-foreground)]">{refreshed}</p>
          {stale ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Snapshot is stale — “today” KPIs may reflect an older UTC day. Click
              Refresh snapshot or reload the page.
            </p>
          ) : null}
        </div>
        <RefreshDashboardButton />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total customers"
          value={dashboard.totalCustomers}
          hint="All customers"
        />
        <MetricCard
          title="Active subscribers"
          value={dashboard.activeSubscribers}
          hint="Open paid subscriptions (distinct customers)"
        />
        <MetricCard
          title="Trials"
          value={dashboard.freeTrials}
          hint="Open free trials only (not ended/converted)"
        />
        <MetricCard
          title="Cancelled"
          value={dashboard.cancelled}
          hint="Cancelled and not expired (current stock)"
        />

        <MetricCard
          title="New customers today"
          value={dashboard.newCustomersToday}
          hint="UTC calendar day"
        />
        <MetricCard
          title="Renewals today"
          value={dashboard.renewalsToday}
          hint="Subscriptions with renewal date today (UTC)"
        />
        <MetricCard
          title="Cancelled today"
          value={dashboard.cancelledToday}
          hint="cancelled_at on UTC calendar day"
        />
        <MetricCard
          title="Revenue today"
          value={money(dashboard.revenueTodayCents)}
          hint="Successful payments today (UTC)"
        />

        <MetricCard
          title="Revenue this month"
          value={money(dashboard.revenueMonthCents)}
          hint="Successful payments MTD (UTC)"
        />
        <MetricCard
          title="Revenue this year"
          value={money(dashboard.revenueYearCents)}
          hint="Successful payments YTD (UTC)"
        />
        <MetricCard
          title="MRR"
          value={money(dashboard.mrrCents)}
          hint="From open paid subscription MRR"
        />
        <MetricCard
          title="ARR"
          value={money(dashboard.arrCents)}
          hint="MRR × 12"
        />
      </div>
    </div>
  );
}
