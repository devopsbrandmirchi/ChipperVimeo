import { Suspense } from "react";

import { GainLossMetrics } from "@/components/analytics/GainLossMetrics";
import { StatCard } from "@/components/cards/MetricCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { LoadingSpinner } from "@/components/common/feedback";
import { RefreshErrorCard } from "@/components/common/RefreshErrorCard";
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

async function DashboardGainLoss({
  preset,
  startDate,
  endDate,
}: {
  preset: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const gainLossRes = await apiGetServer<SubscriptionMetricsResponse>(
      "/analytics/subscription-metrics",
      {
        preset: startDate || endDate ? "custom" : preset,
        startDate,
        endDate,
      },
    );
    return (
      <GainLossMetrics
        data={gainLossRes.data}
        preset={gainLossRes.data.preset || preset}
      />
    );
  } catch (error) {
    const message =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Gain/loss metrics are temporarily unavailable.";
    return (
      <RefreshErrorCard
        title="Unable to load gain / loss metrics"
        message={message}
      />
    );
  }
}

function GainLossFallback() {
  return (
    <StatCard title="Subscription & trial gain / loss">
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
        <LoadingSpinner />
        Loading gain / loss metrics…
      </div>
    </StatCard>
  );
}

export default async function DashboardPage({
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
  let totalCustomers = 0;
  let loadError: string | null = null;

  try {
    // Keep the critical path light so login → dashboard is fast.
    // Gain/loss streams in via Suspense (can be slow / timeout).
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
        <RefreshErrorCard
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
      <Suspense fallback={<GainLossFallback />}>
        <DashboardGainLoss
          preset={preset}
          startDate={startDate}
          endDate={endDate}
        />
      </Suspense>
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
