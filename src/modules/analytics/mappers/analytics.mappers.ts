import type {
  AnalyticsOverview,
  ARRResponse,
  ChurnAnalyticsResponse,
  CountryAnalyticsResponse,
  CustomerAnalyticsResponse,
  DashboardResponse,
  LTVResponse,
  MRRResponse,
  PaymentAnalyticsResponse,
  PlatformAnalyticsResponse,
  ProductAnalyticsResponse,
  RevenueResponse,
  SubscriptionAnalyticsResponse,
  TrialAnalyticsResponse,
} from "@/modules/analytics/dto/responses";
import type {
  ChurnMetricRow,
  CountryMetricRow,
  CustomerMetricRow,
  DailyMetricRow,
  DashboardRow,
  DashboardTodayKpiRow,
  LtvMetricRow,
  MonthlyMetricRow,
  PaymentMetricRow,
  PlatformMetricRow,
  ProductMetricRow,
  SubscriptionMetricRow,
  TrialMetricRow,
} from "@/modules/analytics/types/rows";

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export function mapDashboard(
  row: DashboardRow | null,
  todayLive?: DashboardTodayKpiRow | null,
): DashboardResponse {
  if (!row) {
    const empty = emptyDashboard();
    if (todayLive) {
      return applyTodayLiveOverlay(empty, todayLive);
    }
    return empty;
  }
  const mapped = {
    totalCustomers: num(row.total_customers),
    newCustomersToday: num(row.new_customers_today),
    activeSubscribers: num(row.active_subscribers),
    paused: num(row.paused_subscriptions),
    cancelled: num(row.cancelled_subscriptions),
    expired: num(row.expired_subscriptions),
    freeTrials: num(row.free_trial_subscriptions),
    renewalsToday: num(row.renewals_today),
    cancelledToday: num(row.cancelled_today),
    chargeFailures: num(row.charge_failures),
    recoveredPayments: num(row.recovered_payments),
    revenueTodayCents: num(row.revenue_today_cents),
    revenueWeekCents: num(row.revenue_week_cents),
    revenueMonthCents: num(row.revenue_month_cents),
    revenueYearCents: num(row.revenue_year_cents),
    mrrCents: num(row.mrr_cents),
    arrCents: num(row.arr_cents),
    arpuCents: num(row.arpu_cents),
    arppuProxyCents: num(row.arppu_proxy_cents),
    trialConversionPct: num(row.trial_conversion_pct),
    churnRatePct: num(row.churn_rate_pct),
    retentionRatePct: num(row.retention_rate_pct),
    paymentRecoveryRatePct: num(row.payment_recovery_rate_pct),
    refreshedAt: row.refreshed_at ?? null,
    todayLive: false,
    todayAsOf: null as string | null,
  };
  if (todayLive) {
    return applyTodayLiveOverlay(mapped, todayLive);
  }
  return mapped;
}

function applyTodayLiveOverlay(
  dashboard: DashboardResponse,
  todayLive: DashboardTodayKpiRow,
): DashboardResponse {
  return {
    ...dashboard,
    newCustomersToday: num(todayLive.new_customers_today),
    renewalsToday: num(todayLive.renewals_today),
    cancelledToday: num(todayLive.cancelled_today),
    revenueTodayCents: num(todayLive.revenue_today_cents),
    todayLive: true,
    todayAsOf: todayLive.as_of ?? null,
  };
}

export function emptyDashboard(): DashboardResponse {
  return {
    totalCustomers: 0,
    newCustomersToday: 0,
    activeSubscribers: 0,
    paused: 0,
    cancelled: 0,
    expired: 0,
    freeTrials: 0,
    renewalsToday: 0,
    cancelledToday: 0,
    chargeFailures: 0,
    recoveredPayments: 0,
    revenueTodayCents: 0,
    revenueWeekCents: 0,
    revenueMonthCents: 0,
    revenueYearCents: 0,
    mrrCents: 0,
    arrCents: 0,
    arpuCents: 0,
    arppuProxyCents: 0,
    trialConversionPct: 0,
    churnRatePct: 0,
    retentionRatePct: 0,
    paymentRecoveryRatePct: 0,
    refreshedAt: null,
    todayLive: false,
    todayAsOf: null,
  };
}

/** True when "today" KPIs would be wrong (different UTC day) or snapshot is >1h old. */
export function isDashboardSnapshotStale(
  refreshedAt: string | null | undefined,
  now: Date = new Date(),
  maxAgeMs = 60 * 60 * 1000,
): boolean {
  if (!refreshedAt) return true;
  const refreshed = new Date(refreshedAt);
  if (Number.isNaN(refreshed.getTime())) return true;
  const refreshedDay = refreshed.toISOString().slice(0, 10);
  const todayUtc = now.toISOString().slice(0, 10);
  if (refreshedDay !== todayUtc) return true;
  return now.getTime() - refreshed.getTime() > maxAgeMs;
}

export function mapOverviewFromDashboard(
  dashboard: DashboardResponse,
  countriesTotal: number,
  platformsTotal: number,
): AnalyticsOverview {
  return {
    activeSubscribers: dashboard.activeSubscribers,
    cancelledSubscriptions: dashboard.cancelled,
    trialSubscriptions: dashboard.freeTrials,
    revenue: {
      revenueCents: dashboard.revenueMonthCents,
      currency: null,
      note: "From analytics.mv_dashboard (successful payments this month)",
    },
    countries: {
      dimension: "country",
      total: countriesTotal,
      note: "See /api/v1/analytics/countries for breakdown",
    },
    platforms: {
      dimension: "platform",
      total: platformsTotal,
      note: "See /api/v1/analytics/platforms for breakdown",
    },
  };
}

export function mapRevenue(
  dashboard: DashboardResponse,
  seriesRows: Array<DailyMetricRow | MonthlyMetricRow>,
  groupBy: "day" | "month",
): RevenueResponse {
  return {
    revenueCents: dashboard.revenueMonthCents,
    currency: null,
    note: "From analytics.mv_dashboard + time-series MVs",
    totalRevenueCents:
      dashboard.revenueYearCents || dashboard.revenueMonthCents,
    revenueTodayCents: dashboard.revenueTodayCents,
    revenueWeekCents: dashboard.revenueWeekCents,
    revenueMonthCents: dashboard.revenueMonthCents,
    revenueYearCents: dashboard.revenueYearCents,
    series: seriesRows.map((row) => ({
      period:
        groupBy === "day"
          ? String((row as DailyMetricRow).metric_date)
          : String((row as MonthlyMetricRow).metric_month),
      revenueCents: num(row.revenue_cents),
    })),
    refreshedAt: dashboard.refreshedAt,
  };
}

export function mapSubscriptions(
  row: SubscriptionMetricRow | null,
): SubscriptionAnalyticsResponse {
  if (!row) {
    return {
      total: 0,
      open: 0,
      paused: 0,
      cancelled: 0,
      expired: 0,
      freeTrial: 0,
      monthly: 0,
      yearly: 0,
      mrrCents: 0,
      avgSubscriptionDurationDays: 0,
      refreshedAt: null,
    };
  }
  return {
    total: num(row.total_subscriptions),
    open: num(row.open_subscriptions),
    paused: num(row.paused_subscriptions),
    cancelled: num(row.cancelled_subscriptions),
    expired: num(row.expired_subscriptions),
    freeTrial: num(row.free_trial_subscriptions),
    monthly: num(row.monthly_subscriptions),
    yearly: num(row.yearly_subscriptions),
    mrrCents: num(row.mrr_cents),
    avgSubscriptionDurationDays: num(row.avg_subscription_duration_days),
    refreshedAt: row.refreshed_at ?? null,
  };
}

export function mapProducts(rows: ProductMetricRow[]): ProductAnalyticsResponse {
  return {
    products: rows.map((r) => ({
      productId: r.product_id,
      name: r.product_name,
      subscribers: num(r.subscribers),
      openSubscribers: num(r.open_subscribers),
      trials: num(r.trials),
      cancellations: num(r.cancellations),
      revenueCents: num(r.revenue_cents),
      mrrContributionCents: num(r.mrr_contribution_cents),
      arrContributionCents: num(r.arr_contribution_cents),
      cancellationPct: num(r.cancellation_pct),
    })),
    refreshedAt: rows[0]?.refreshed_at ?? null,
  };
}

export function mapCountries(rows: CountryMetricRow[]): CountryAnalyticsResponse {
  return {
    dimension: "country",
    total: rows.length,
    note: "From analytics.mv_country_metrics",
    countries: rows.map((r) => ({
      country: r.country,
      customerCount: num(r.customer_count),
      openSubscriptionCount: num(r.open_subscription_count),
      mrrCents: num(r.mrr_cents),
      revenueCents: num(r.revenue_cents),
    })),
    refreshedAt: rows[0]?.refreshed_at ?? null,
  };
}

export function mapPlatforms(
  rows: PlatformMetricRow[],
): PlatformAnalyticsResponse {
  return {
    dimension: "platform",
    total: rows.length,
    note: "From analytics.mv_platform_metrics",
    platforms: rows.map((r) => ({
      platform: r.platform,
      customerCount: num(r.customer_count),
      openSubscriptionCount: num(r.open_subscription_count),
      mrrCents: num(r.mrr_cents),
      revenueCents: num(r.revenue_cents),
    })),
    refreshedAt: rows[0]?.refreshed_at ?? null,
  };
}

export function mapPayments(row: PaymentMetricRow | null): PaymentAnalyticsResponse {
  if (!row) {
    return {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      recoveredPayments: 0,
      revenueCents: 0,
      refreshedAt: null,
    };
  }
  return {
    totalPayments: num(row.total_payments),
    successfulPayments: num(row.successful_payments),
    failedPayments: num(row.failed_payments),
    recoveredPayments: num(row.recovered_payments),
    revenueCents: num(row.revenue_cents),
    refreshedAt: row.refreshed_at ?? null,
  };
}

export function mapTrials(
  row: TrialMetricRow | null,
  trialConversionPct: number,
): TrialAnalyticsResponse {
  if (!row) {
    return {
      totalTrials: 0,
      activeTrials: 0,
      trialsExpiringSoon: 0,
      trialConversionsProxy: 0,
      trialConversionPct: 0,
      refreshedAt: null,
    };
  }
  return {
    totalTrials: num(row.total_trials),
    activeTrials: num(row.active_trials),
    trialsExpiringSoon: num(row.trials_expiring_soon),
    trialConversionsProxy: num(row.trial_conversions_proxy),
    trialConversionPct,
    refreshedAt: row.refreshed_at ?? null,
  };
}

export function mapChurn(
  row: ChurnMetricRow | null,
  retentionRatePct: number,
): ChurnAnalyticsResponse {
  if (!row) {
    return {
      cancelledTotal: 0,
      cancelledThisMonth: 0,
      retainedOpen: 0,
      churnRatePct: 0,
      retentionRatePct: 0,
      refreshedAt: null,
    };
  }
  return {
    cancelledTotal: num(row.cancelled_total),
    cancelledThisMonth: num(row.cancelled_this_month),
    retainedOpen: num(row.retained_open),
    churnRatePct: num(row.churn_rate_pct),
    retentionRatePct,
    refreshedAt: row.refreshed_at ?? null,
  };
}

export function mapMrr(dashboard: DashboardResponse): MRRResponse {
  return {
    mrrCents: dashboard.mrrCents,
    arrCents: dashboard.arrCents,
    refreshedAt: dashboard.refreshedAt,
  };
}

export function mapArr(dashboard: DashboardResponse): ARRResponse {
  return {
    arrCents: dashboard.arrCents,
    mrrCents: dashboard.mrrCents,
    refreshedAt: dashboard.refreshedAt,
  };
}

export function mapLtv(row: LtvMetricRow | null): LTVResponse {
  if (!row) {
    return {
      avgLtvCents: 0,
      medianLtvCents: 0,
      maxLtvCents: 0,
      payingCustomers: 0,
      refreshedAt: null,
    };
  }
  return {
    avgLtvCents: num(row.avg_ltv_cents),
    medianLtvCents: num(row.median_ltv_cents),
    maxLtvCents: num(row.max_ltv_cents),
    payingCustomers: num(row.paying_customers),
    refreshedAt: row.refreshed_at ?? null,
  };
}

export function mapCustomerAnalytics(input: {
  dashboard: DashboardResponse;
  topLtv: CustomerMetricRow[];
  inTrial: CustomerMetricRow[];
  failedPayments: CustomerMetricRow[];
  recentlyCancelled: CustomerMetricRow[];
  countries: CountryMetricRow[];
  platforms: PlatformMetricRow[];
}): CustomerAnalyticsResponse {
  return {
    activeSubscribers: input.dashboard.activeSubscribers,
    totalCustomers: input.dashboard.totalCustomers,
    topLtv: input.topLtv.map((r) => ({
      customerId: r.customer_id,
      email: r.email,
      lifetimeRevenueCents: num(r.lifetime_revenue_cents),
      country: r.country,
      platform: r.platform,
    })),
    inTrial: input.inTrial.map((r) => ({
      customerId: r.customer_id,
      email: r.email,
    })),
    failedPayments: input.failedPayments.map((r) => ({
      customerId: r.customer_id,
      email: r.email,
      failedPaymentCount: num(r.failed_payment_count),
    })),
    recentlyCancelled: input.recentlyCancelled.map((r) => ({
      customerId: r.customer_id,
      email: r.email,
    })),
    byCountry: input.countries.map((r) => ({
      country: r.country,
      customerCount: num(r.customer_count),
      revenueCents: num(r.revenue_cents),
    })),
    byPlatform: input.platforms.map((r) => ({
      platform: r.platform,
      customerCount: num(r.customer_count),
      revenueCents: num(r.revenue_cents),
    })),
    refreshedAt: input.dashboard.refreshedAt,
  };
}
