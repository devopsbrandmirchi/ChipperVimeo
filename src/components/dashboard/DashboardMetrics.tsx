import { MetricCard } from "@/components/cards/MetricCard";

export function DashboardMetrics({
  totalCustomers,
  activeSubscribers,
  trials,
  cancelled,
  revenueCents,
  revenueNote,
}: {
  totalCustomers: number;
  activeSubscribers: number;
  trials: number;
  cancelled: number;
  revenueCents: number;
  revenueNote?: string;
}) {
  const placeholder = "Placeholder — analytics phase";
  const revenueDisplay =
    revenueCents > 0
      ? `$${(revenueCents / 100).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}`
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Total customers" value={totalCustomers} />
      <MetricCard
        title="Active subscribers"
        value={activeSubscribers}
        hint="Open paid subscriptions (distinct customers)"
      />
      <MetricCard
        title="Trials"
        value={trials}
        hint="Open free trials only (not ended/converted)"
      />
      <MetricCard
        title="Cancelled"
        value={cancelled}
        hint="Cancelled and not expired (current stock)"
      />
      <MetricCard
        title="Monthly revenue"
        value={revenueDisplay}
        hint={revenueNote ?? placeholder}
        placeholder={revenueCents === 0}
      />
      <MetricCard
        title="Annual revenue"
        value="—"
        hint={placeholder}
        placeholder
      />
      <MetricCard title="MRR" value="—" hint={placeholder} placeholder />
      <MetricCard title="ARR" value="—" hint={placeholder} placeholder />
      <MetricCard
        title="Renewals today"
        value="—"
        hint={placeholder}
        placeholder
      />
      <MetricCard
        title="Cancelled today"
        value="—"
        hint={placeholder}
        placeholder
      />
      <MetricCard
        title="Revenue today"
        value="—"
        hint={placeholder}
        placeholder
      />
      <MetricCard
        title="Revenue this month"
        value={revenueDisplay}
        hint={revenueNote ?? placeholder}
        placeholder={revenueCents === 0}
      />
    </div>
  );
}
