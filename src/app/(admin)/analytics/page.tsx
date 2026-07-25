import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { ErrorCard, ModulePlaceholder } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type {
  AnalyticsOverview,
  DimensionSummary,
  RevenueSummary,
} from "@/services/interfaces/analytics-service.interface";

export default async function AnalyticsPage() {
  let overview: AnalyticsOverview | null = null;
  let revenue: RevenueSummary | null = null;
  let countries: DimensionSummary | null = null;
  let platforms: DimensionSummary | null = null;
  let loadError: string | null = null;

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

  if (loadError || !overview || !revenue || !countries || !platforms) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" breadcrumbs={[{ label: "Analytics" }]} />
        <ErrorCard
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
        description="Charts consume analytics endpoints. Calculations remain placeholder-level."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics" },
        ]}
      />
      <ModulePlaceholder
        title="Analytics layout"
        description="Full report builders ship in a later phase. Values below come from existing /api/v1/analytics/* routes."
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
