import { Suspense } from "react";
import { z } from "zod";

import { CohortMatrix } from "@/components/analytics/CohortMatrix";
import { GainLossMetrics } from "@/components/analytics/GainLossMetrics";
import { GainLossToolbar } from "@/components/analytics/GainLossToolbar";
import { SubscriptionHealthMetrics } from "@/components/analytics/SubscriptionHealthMetrics";
import { StatCard } from "@/components/cards/MetricCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { LoadingSpinner } from "@/components/common/feedback";
import { RefreshErrorCard } from "@/components/common/RefreshErrorCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { subscriptionMetricsPresetSchema } from "@/modules/analytics/dto/filters";
import { mapSubscriptionHealthStock } from "@/modules/analytics/mappers/subscription-health.mappers";
import { resolveSubscriptionMetricsRange } from "@/modules/analytics/mappers/subscription-metrics.mappers";
import type {
  AnalyticsOverview,
  ChurnAnalyticsResponse,
  CohortMatrixResponse,
  CountryAnalyticsResponse,
  DailyAnalyticsResponse,
  PlatformAnalyticsResponse,
  ProductAnalyticsResponse,
  RevenueResponse,
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

async function AnalyticsCohorts() {
  try {
    const data = await apiGetServer<CohortMatrixResponse>("/analytics/cohorts");
    return <CohortMatrix data={data.data} />;
  } catch (error) {
    const message =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Apply migration 042 (fn_cohort_revenue_churn_matrix).";
    return (
      <RefreshErrorCard
        title="Unable to load cohort matrix"
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

  const [overview, daily, countries, platforms, products, gainLossLast30] =
    await Promise.all([
      safeGet<AnalyticsOverview>("/analytics/overview"),
      safeGet<DailyAnalyticsResponse>("/analytics/daily"),
      safeGet<CountryAnalyticsResponse>("/analytics/countries"),
      safeGet<PlatformAnalyticsResponse>("/analytics/platforms"),
      safeGet<ProductAnalyticsResponse>("/analytics/products"),
      safeGet<SubscriptionMetricsResponse>("/analytics/subscription-metrics", {
        preset: "last30",
      }),
    ]);

  // Soft-fail charts if overview missing; gain/loss still loads in Suspense.
  if (!overview) {
    const revenue = await safeGet<RevenueResponse>("/analytics/revenue");
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" breadcrumbs={[{ label: "Analytics" }]} />
        <RefreshErrorCard
          title="Unable to load analytics overview"
          message={
            revenue?.note ??
            "Overview snapshot unavailable. Gain/loss below may still work."
          }
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
      </div>
    );
  }

  const dailyCustomerGrowth =
    daily?.customers.map((r) => ({
      name: shortDate(r.date),
      value: r.newCustomers,
    })) ?? [];

  const dailyRevenueTrend =
    daily?.payments.map((r) => ({
      name: shortDate(r.date),
      value: Number((r.revenueCents / 100).toFixed(2)),
    })) ?? [];

  const dailySubscriptionGrowth =
    daily?.subscriptions.map((r) => ({
      name: shortDate(r.date),
      value: r.netGrowth,
    })) ?? [];

  const gainLossSeries = [...(gainLossLast30?.series ?? [])].sort((a, b) =>
    (a.reportDate ?? a.key).localeCompare(b.reportDate ?? b.key),
  );

  const fallbackCustomerGrowth = gainLossSeries.map((r) => ({
    name: shortDate(r.reportDate ?? r.key),
    value: r.uniqueCustomersGain,
  }));

  const fallbackSubscriptionGrowth = gainLossSeries.map((r) => ({
    name: shortDate(r.reportDate ?? r.key),
    value: r.subscriptionGain - r.subscriptionLoss,
  }));

  const usingDailyCustomer = dailyCustomerGrowth.length > 0;
  const usingDailyRevenue = dailyRevenueTrend.length > 0;
  const usingDailySubs = dailySubscriptionGrowth.length > 0;

  const customerGrowth = usingDailyCustomer
    ? dailyCustomerGrowth
    : fallbackCustomerGrowth;
  const revenueTrend = dailyRevenueTrend;
  const subscriptionGrowth = usingDailySubs
    ? dailySubscriptionGrowth
    : fallbackSubscriptionGrowth;

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

  const dailySourceNote =
    daily?.source === "mv_daily_metrics"
      ? "analytics.mv_daily_metrics"
      : daily
        ? "daily snapshots"
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Gain/loss from subscription_events, plus chart breakdowns from analytics MVs."
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

      <Suspense
        fallback={
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        }
      >
        <AnalyticsCohorts />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Snapshot overview
        </h2>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Stat label="Active subscribers" value={overview.activeSubscribers} />
          <Stat label="Trials" value={overview.trialSubscriptions} />
          <Stat label="Cancelled" value={overview.cancelledSubscriptions} />
        </div>
      </section>

      <DashboardCharts
        customerGrowth={customerGrowth}
        revenueTrend={revenueTrend}
        subscriptionGrowth={subscriptionGrowth}
        platforms={platformPoints}
        countries={countryPoints}
        topProducts={productPoints}
        notes={{
          customers: usingDailyCustomer
            ? `Last 30 UTC days from ${dailySourceNote}. Values = new customers / day.`
            : customerGrowth.length > 0
              ? "Fallback: last 30 UTC days from subscription_events (unique customers gain / day)."
              : "No series yet. Run in Supabase: select analytics.refresh_daily_metrics();",
          revenue: usingDailyRevenue
            ? `Last 30 UTC days from ${dailySourceNote}. Values = successful payment revenue ($).`
            : "No revenue series yet — analytics.mv_daily_metrics is empty. Run: select analytics.refresh_daily_metrics();",
          subscriptions: usingDailySubs
            ? `Last 30 UTC days from ${dailySourceNote}. Values = net subscription growth / day.`
            : subscriptionGrowth.length > 0
              ? "Fallback: last 30 UTC days from subscription_events (subscription gain − loss / day)."
              : "No series yet. Run in Supabase: select analytics.refresh_daily_metrics();",
          platforms:
            platforms?.note ?? "Open subscribers by platform (top 8).",
          countries: countries?.note ?? "Open subscribers by country (top 8).",
          products: "Open subscribers by product (top 8).",
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
