import { Suspense } from "react";
import { z } from "zod";

import { GainLossMetrics } from "@/components/analytics/GainLossMetrics";
import { GainLossToolbar } from "@/components/analytics/GainLossToolbar";
import { SubscriptionHealthMetrics } from "@/components/analytics/SubscriptionHealthMetrics";
import { StatCard } from "@/components/cards/MetricCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { LoadingSpinner } from "@/components/common/feedback";
import { RefreshErrorCard } from "@/components/common/RefreshErrorCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { subscriptionMetricsPresetSchema } from "@/modules/analytics/dto/filters";
import { mapSubscriptionHealthStock } from "@/modules/analytics/mappers/subscription-health.mappers";
import { resolveSubscriptionMetricsRange } from "@/modules/analytics/mappers/subscription-metrics.mappers";
import type {
  ChurnAnalyticsResponse,
  CountryAnalyticsResponse,
  DailyAnalyticsResponse,
  DashboardResponse,
  PlatformAnalyticsResponse,
  ProductAnalyticsResponse,
  SubscriptionMetricsResponse,
  TrialAnalyticsResponse,
} from "@/modules/analytics/dto/responses";

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

function shortDate(iso: string): string {
  // YYYY-MM-DD → MM-DD for denser chart axes
  return iso.length >= 10 ? iso.slice(5, 10) : iso;
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
    <StatCard title="Metrics">
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
  const presetParam = parsePreset(first(sp.preset));
  const startDate = first(sp.startDate);
  const endDate = first(sp.endDate);
  const range = resolveSubscriptionMetricsRange({
    preset: startDate || endDate ? "custom" : presetParam,
    startDate,
    endDate,
  });

  let dashboard: DashboardResponse | null = null;
  let loadError: string | null = null;

  try {
    const dashboardRes = await apiGetServer<DashboardResponse>(
      "/analytics/dashboard",
    );
    dashboard = dashboardRes.data;
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load dashboard";
  }

  if (loadError || !dashboard) {
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

  const [daily, countries, platforms, products] = await Promise.all([
    safeGet<DailyAnalyticsResponse>("/analytics/daily"),
    safeGet<CountryAnalyticsResponse>("/analytics/countries"),
    safeGet<PlatformAnalyticsResponse>("/analytics/platforms"),
    safeGet<ProductAnalyticsResponse>("/analytics/products"),
  ]);

  const customerGrowth =
    daily?.customers.map((r) => ({
      name: shortDate(r.date),
      value: r.newCustomers,
    })) ?? [];

  const revenueTrend =
    daily?.payments.map((r) => ({
      name: shortDate(r.date),
      value: Number((r.revenueCents / 100).toFixed(2)),
    })) ?? [];

  const subscriptionGrowth =
    daily?.subscriptions.map((r) => ({
      name: shortDate(r.date),
      value: r.netGrowth,
    })) ?? [];

  const platformPoints =
    platforms?.platforms.slice(0, 8).map((p) => ({
      name: p.platform || "Unknown",
      value: p.openSubscriptionCount || p.customerCount,
    })) ?? [];

  const countryPoints =
    countries?.countries.slice(0, 8).map((c) => ({
      name: c.country || "Unknown",
      value: c.openSubscriptionCount || c.customerCount,
    })) ?? [];

  const productPoints =
    products?.products.slice(0, 8).map((p) => ({
      name: p.name || p.productId.slice(0, 8),
      value: p.openSubscribers || p.subscribers,
    })) ?? [];

  const chartSource =
    daily?.source === "mv_daily_metrics"
      ? "Last 30 UTC days from analytics.mv_daily_metrics"
      : daily
        ? "Last 30 UTC days from daily snapshots"
        : "Series unavailable — refresh analytics MVs";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Subscription analytics overview for your Vimeo OTT audience."
        breadcrumbs={[{ label: "Dashboard" }]}
      />
      <section className="space-y-4">
        <GainLossToolbar
          preset={range.preset}
          startDate={range.startDate}
          endDate={range.endDate}
        />
        <Suspense fallback={<GainLossFallback />}>
          <DashboardGainLoss
            preset={presetParam}
            startDate={startDate}
            endDate={endDate}
          />
        </Suspense>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Executive snapshot
        </h2>
        <DashboardMetrics dashboard={dashboard} />
      </section>
      <DashboardCharts
        customerGrowth={customerGrowth}
        revenueTrend={revenueTrend}
        subscriptionGrowth={subscriptionGrowth}
        platforms={platformPoints}
        countries={countryPoints}
        topProducts={productPoints}
        notes={{
          customers: `${chartSource}. Values = new customers / day.`,
          revenue: `${chartSource}. Values = successful payment revenue ($).`,
          subscriptions: `${chartSource}. Values = net subscription growth / day.`,
          platforms:
            platforms?.note ?? "Open subscribers by platform (top 8).",
          countries: countries?.note ?? "Open subscribers by country (top 8).",
          products: "Open subscribers by product (top 8).",
        }}
      />
    </div>
  );
}
