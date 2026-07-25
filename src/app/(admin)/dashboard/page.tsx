import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { ErrorCard } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type {
  AnalyticsOverview,
  RevenueSummary,
} from "@/services/interfaces/analytics-service.interface";
import type { Customer } from "@/types/database";

export default async function DashboardPage() {
  let overview: AnalyticsOverview | null = null;
  let revenue: RevenueSummary | null = null;
  let totalCustomers = 0;
  let loadError: string | null = null;

  try {
    const [overviewRes, revenueRes, customersRes] = await Promise.all([
      apiGetServer<AnalyticsOverview>("/analytics/overview"),
      apiGetServer<RevenueSummary>("/analytics/revenue"),
      apiGetServer<Customer[]>("/customers", { page: 1, pageSize: 1 }),
    ]);
    overview = overviewRes.data;
    revenue = revenueRes.data;
    totalCustomers = customersRes.meta?.total ?? 0;
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
