import { GainLossMetrics } from "@/components/analytics/GainLossMetrics";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { ModulePlaceholder } from "@/components/common/feedback";
import { RefreshErrorCard } from "@/components/common/RefreshErrorCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { SubscriptionMetricsResponse } from "@/modules/analytics/dto/responses";
import type {
  AnalyticsOverview,
  DimensionSummary,
  RevenueSummary,
} from "@/services/interfaces/analytics-service.interface";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const preset = first(sp.preset) ?? "last7";
  const startDate = first(sp.startDate);
  const endDate = first(sp.endDate);

  let overview: AnalyticsOverview | null = null;
  let revenue: RevenueSummary | null = null;
  let countries: DimensionSummary | null = null;
  let platforms: DimensionSummary | null = null;
  let gainLoss: SubscriptionMetricsResponse | null = null;
  let loadError: string | null = null;
  let gainLossError: string | null = null;

  try {
    const [overviewRes, revenueRes, countriesRes, platformsRes] =
      await Promise.all([
        apiGetServer<AnalyticsOverview>("/analytics/overview"),
        apiGetServer<RevenueSummary>("/analytics/revenue"),
        apiGetServer<DimensionSummary>("/analytics/countries"),
        apiGetServer<DimensionSummary>("/analytics/platforms"),
      ]);
    overview = overviewRes.data;
    revenue = revenueRes.data;
    countries = countriesRes.data;
    platforms = platformsRes.data;
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Request failed";
  }

  try {
    const gainLossRes = await apiGetServer<SubscriptionMetricsResponse>(
      "/analytics/subscription-metrics",
      {
        preset: startDate || endDate ? "custom" : preset,
        startDate,
        endDate,
      },
    );
    gainLoss = gainLossRes.data;
  } catch (error) {
    gainLossError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load gain/loss metrics";
  }

  if (loadError || !overview || !revenue || !countries || !platforms) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" breadcrumbs={[{ label: "Analytics" }]} />
        <RefreshErrorCard
          title="Unable to load analytics"
          message={loadError ?? "Missing analytics data"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Gain/loss reporting from subscription_events. Other charts remain snapshot-level."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics" },
        ]}
      />

      {gainLoss ? (
        <GainLossMetrics data={gainLoss} preset={gainLoss.preset || preset} />
      ) : (
        <RefreshErrorCard
          title="Unable to load gain / loss metrics"
          message={
            gainLossError ??
            "Apply migration 022 and ensure subscription_events are populated."
          }
        />
      )}

      <ModulePlaceholder
        title="Snapshot overview"
        description="Values below come from existing /api/v1/analytics/* snapshot routes."
      >
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Stat label="Active subscribers" value={overview.activeSubscribers} />
          <Stat label="Trials" value={overview.trialSubscriptions} />
          <Stat label="Cancelled" value={overview.cancelledSubscriptions} />
        </div>
      </ModulePlaceholder>
      <DashboardCharts
        customerGrowth={[]}
        revenueTrend={[]}
        subscriptionGrowth={[
          { name: "Active", value: overview.activeSubscribers },
          { name: "Trial", value: overview.trialSubscriptions },
          { name: "Cancelled", value: overview.cancelledSubscriptions },
        ]}
        platforms={[{ name: "All platforms", value: platforms.total }]}
        countries={[{ name: "All countries", value: countries.total }]}
        topProducts={[]}
        notes={{
          customers: "Series not implemented yet.",
          revenue: revenue.note,
          subscriptions: "Snapshot counts from overview.",
          platforms: platforms.note,
          countries: countries.note,
          products: "Top products not implemented yet.",
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
