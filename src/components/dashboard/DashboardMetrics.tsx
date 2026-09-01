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
  const snapshotLabel = dashboard.refreshedAt
    ? `Stock / MRR / MTD snapshot as of ${formatUtc(dashboard.refreshedAt)}`
    : "Stock / MRR / MTD snapshot time unknown";
  const todayLabel = dashboard.todayLive
    ? `Today KPIs are live UTC${
        dashboard.todayAsOf ? ` (queried ${formatUtc(dashboard.todayAsOf)})` : ""
      }`
    : "Today KPIs from snapshot (apply migration 035 for live today cards)";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs text-[var(--muted-foreground)]">{todayLabel}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{snapshotLabel}</p>
          {stale ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Snapshot is older than today UTC — MTD / MRR / ARR may lag. Click
              Refresh snapshot to rebuild analytics.mv_dashboard.
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
          hint={dashboard.todayLive ? "Live UTC calendar day" : "UTC calendar day"}
        />
        <MetricCard
          title="Renewals today"
          value={dashboard.renewalsToday}
          hint={
            dashboard.todayLive
              ? "Live · renewal date today (UTC)"
              : "Subscriptions with renewal date today (UTC)"
          }
        />
        <MetricCard
          title="Cancelled today"
          value={dashboard.cancelledToday}
          hint={
            dashboard.todayLive
              ? "Live · cancelled_at on UTC day"
              : "cancelled_at on UTC calendar day"
          }
        />
        <MetricCard
          title="Revenue today"
          value={money(dashboard.revenueTodayCents)}
          hint={
            dashboard.todayLive
              ? "Live · successful payments today (UTC)"
              : "Successful payments today (UTC)"
          }
        />

        <MetricCard
          title="Revenue this month"
          value={money(dashboard.revenueMonthCents)}
          hint="Successful payments MTD (UTC) · from snapshot"
        />
        <MetricCard
          title="Revenue this year"
          value={money(dashboard.revenueYearCents)}
          hint="Successful payments YTD (UTC) · from snapshot"
        />
        <MetricCard
          title="MRR"
          value={money(dashboard.mrrCents)}
          hint="From open paid subscription MRR · snapshot"
        />
        <MetricCard
          title="ARR"
          value={money(dashboard.arrCents)}
          hint="MRR × 12 · snapshot"
        />
      </div>
    </div>
  );
}
