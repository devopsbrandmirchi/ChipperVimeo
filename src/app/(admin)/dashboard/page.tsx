import { GainLossMetrics } from "@/components/analytics/GainLossMetrics";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { ErrorCard } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { SubscriptionMetricsResponse } from "@/modules/analytics/dto/responses";
import type {
  AnalyticsOverview,
  RevenueSummary,
} from "@/services/interfaces/analytics-service.interface";
import type { Customer } from "@/types/database";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const preset = first(sp.preset) ?? "last7";

  let overview: AnalyticsOverview | null = null;
  let revenue: RevenueSummary | null = null;
  let totalCustomers = 0;
  let gainLoss: SubscriptionMetricsResponse | null = null;
  let loadError: string | null = null;

  try {
    const [overviewRes, revenueRes, customersRes, gainLossRes] =
      await Promise.all([
        apiGetServer<AnalyticsOverview>("/analytics/overview"),
        apiGetServer<RevenueSummary>("/analytics/revenue"),
        apiGetServer<Customer[]>("/customers", { page: 1, pageSize: 1 }),
        apiGetServer<SubscriptionMetricsResponse>(
          "/analytics/subscription-metrics",
          { preset },
        ).catch(() => null),
      ]);
    overview = overviewRes.data;
    revenue = revenueRes.data;
    totalCustomers = customersRes.meta?.total ?? 0;
    gainLoss = gainLossRes?.data ?? null;
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load dashboard";
  }

  if (loadError || !overview || !revenue) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" breadcrumbs={[{ label: "Dashboard" }]} />
        <ErrorCard
          title="Unable to load dashboard"
          message={loadError ?? "Missing analytics data"}
        />
      </div>
    );
  }

  const snapshotPoints = [
    { name: "Active", value: overview.activeSubscribers },
    { name: "Trial", value: overview.trialSubscriptions },
    { name: "Cancelled", value: overview.cancelledSubscriptions },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Subscription analytics overview for your Vimeo OTT audience."
        breadcrumbs={[{ label: "Dashboard" }]}
      />
      {gainLoss ? (
        <GainLossMetrics data={gainLoss} preset={gainLoss.preset || preset} />
      ) : null}
      <DashboardMetrics
        totalCustomers={totalCustomers}
        activeSubscribers={overview.activeSubscribers}
        trials={overview.trialSubscriptions}
        cancelled={overview.cancelledSubscriptions}
        revenueCents={revenue.revenueCents}
        revenueNote={revenue.note}
      />
      <DashboardCharts
        customerGrowth={[]}
        revenueTrend={[]}
        subscriptionGrowth={snapshotPoints}
        platforms={[
          { name: "All platforms", value: overview.platforms.total },
        ]}
        countries={[
          { name: "All countries", value: overview.countries.total },
        ]}
        topProducts={[]}
        notes={{
          customers: "Time-series growth arrives in a later analytics phase.",
          revenue: revenue.note,
          subscriptions: "Snapshot from current subscription counts.",
          platforms: overview.platforms.note,
          countries: overview.countries.note,
          products: "Product ranking not available yet.",
        }}
      />
    </div>
  );
}
