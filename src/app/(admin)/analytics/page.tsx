import { Suspense } from "react";
import { z } from "zod";

import { GainLossMetrics } from "@/components/analytics/GainLossMetrics";
import { GainLossToolbar } from "@/components/analytics/GainLossToolbar";
import { SubscriptionHealthMetrics } from "@/components/analytics/SubscriptionHealthMetrics";
import { StatCard } from "@/components/cards/MetricCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { LoadingSpinner, ModulePlaceholder } from "@/components/common/feedback";
import { RefreshErrorCard } from "@/components/common/RefreshErrorCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { subscriptionMetricsPresetSchema } from "@/modules/analytics/dto/filters";
import { mapSubscriptionHealthStock } from "@/modules/analytics/mappers/subscription-health.mappers";
import { resolveSubscriptionMetricsRange } from "@/modules/analytics/mappers/subscription-metrics.mappers";
import type {
  ChurnAnalyticsResponse,
  SubscriptionMetricsResponse,
  TrialAnalyticsResponse,
} from "@/modules/analytics/dto/responses";
import type {
  AnalyticsOverview,
  DimensionSummary,
  RevenueSummary,
} from "@/services/interfaces/analytics-service.interface";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type MetricsPreset = z.infer<typeof subscriptionMetricsPresetSchema>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePreset(value: string | undefined): MetricsPreset {
  const parsed = subscriptionMetricsPresetSchema.safeParse(value ?? "yesterday");
  return parsed.success ? parsed.data : "yesterday";
}

async function safeGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<T | null> {
  try {
    const res = await apiGetServer<T>(path, params);
    return res.data;
  } catch {
    return null;
  }
}

async function AnalyticsGainLoss({
  preset,
  startDate,
  endDate,
}: {
  preset: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const [gainLossRes, churn, trials] = await Promise.all([
      apiGetServer<SubscriptionMetricsResponse>(
        "/analytics/subscription-metrics",
        {
          preset: startDate || endDate ? "custom" : preset,
          startDate,
          endDate,
        },
      ),
      safeGet<ChurnAnalyticsResponse>("/analytics/churn"),
      safeGet<TrialAnalyticsResponse>("/analytics/trials"),
    ]);
    const stock = mapSubscriptionHealthStock(churn, trials);
    return (
      <div className="space-y-8">
        <GainLossMetrics
          data={gainLossRes.data}
          preset={gainLossRes.data.preset || preset}
          showHeader={false}
        />
        <SubscriptionHealthMetrics data={gainLossRes.data} stock={stock} />
      </div>
    );
  } catch (error) {
    const message =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Apply migration 022 and ensure subscription_events are populated.";
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
    <StatCard title="Metrics">
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
        <LoadingSpinner />
        Loading gain / loss metrics…
      </div>
    </StatCard>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const presetParam = parsePreset(first(sp.preset));
  const startDate = first(sp.startDate);
  const endDate = first(sp.endDate);
  const range = resolveSubscriptionMetricsRange({
    preset: startDate || endDate ? "custom" : presetParam,
    startDate,
    endDate,
  });

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

      <section className="space-y-4">
        <GainLossToolbar
          preset={range.preset}
          startDate={range.startDate}
          endDate={range.endDate}
        />
        <Suspense fallback={<GainLossFallback />}>
          <AnalyticsGainLoss
            preset={presetParam}
            startDate={startDate}
            endDate={endDate}
          />
        </Suspense>
      </section>

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
