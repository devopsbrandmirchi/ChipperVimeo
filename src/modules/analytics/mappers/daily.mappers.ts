import type { AnalyticsFilters } from "@/modules/analytics/dto/filters";
import type {
  CountryAnalyticsResponse,
  DailyAnalyticsResponse,
  PaymentAnalyticsResponse,
  PlatformAnalyticsResponse,
  ProductAnalyticsResponse,
  RevenueResponse,
  SubscriptionAnalyticsResponse,
  TrialAnalyticsResponse,
} from "@/modules/analytics/dto/responses";
import type {
  DailyCountryMetricRow,
  DailyCustomerMetricRow,
  DailyPaymentMetricRow,
  DailyPlatformMetricRow,
  DailyProductMetricRow,
  DailySubscriptionMetricRow,
  DailyTrialMetricRow,
} from "@/modules/analytics/types/daily-rows";

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export function hasHistoricalRange(filters?: AnalyticsFilters): boolean {
  if (!filters) return false;
  return Boolean(filters.dateFrom || filters.dateTo || filters.date);
}

function periodKey(
  date: string,
  groupBy: AnalyticsFilters["groupBy"] = "day",
): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (groupBy === "year") return `${y}`;
  if (groupBy === "quarter") {
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `${y}-Q${q}`;
  }
  if (groupBy === "month" || groupBy === "week") {
    // week → ISO week approximated as month bucket for MVP rollup consistency with Phase 9 revenue
    if (groupBy === "month") return `${y}-${m}`;
    // week: use Monday-start ISO-like key
    const tmp = new Date(d);
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum);
    return tmp.toISOString().slice(0, 10);
  }
  return `${y}-${m}-${day}`;
}

export function mapDailySubscriptionSeries(
  rows: DailySubscriptionMetricRow[],
  groupBy: AnalyticsFilters["groupBy"] = "day",
): SubscriptionAnalyticsResponse & {
  series: Array<{
    period: string;
    newSubscriptions: number;
    renewals: number;
    cancellations: number;
    expirations: number;
    paused: number;
    resumed: number;
    activeSubscriptions: number;
    netGrowth: number;
    churnRate: number;
  }>;
  source: "daily_snapshots";
} {
  const buckets = new Map<
    string,
    {
      newSubscriptions: number;
      renewals: number;
      cancellations: number;
      expirations: number;
      paused: number;
      resumed: number;
      activeSubscriptions: number;
      netGrowth: number;
    }
  >();

  for (const row of rows) {
    const key = periodKey(row.date, groupBy);
    const cur = buckets.get(key) ?? {
      newSubscriptions: 0,
      renewals: 0,
      cancellations: 0,
      expirations: 0,
      paused: 0,
      resumed: 0,
      activeSubscriptions: 0,
      netGrowth: 0,
    };
    cur.newSubscriptions += num(row.new_subscriptions);
    cur.renewals += num(row.renewals);
    cur.cancellations += num(row.cancellations);
    cur.expirations += num(row.expirations);
    cur.paused += num(row.paused);
    cur.resumed += num(row.resumed);
    cur.netGrowth += num(row.net_growth);
    // last EOD active in bucket wins for day; for rollups use max as proxy
    cur.activeSubscriptions = Math.max(
      cur.activeSubscriptions,
      num(row.active_subscriptions),
    );
    buckets.set(key, cur);
  }

  const series = [...buckets.entries()].map(([period, v]) => ({
    period,
    ...v,
    churnRate:
      v.activeSubscriptions + v.cancellations > 0
        ? Number(
            (
              (v.cancellations / (v.activeSubscriptions + v.cancellations)) *
              100
            ).toFixed(2),
          )
        : 0,
  }));

  const totals = series.reduce(
    (acc, s) => {
      acc.newSubscriptions += s.newSubscriptions;
      acc.renewals += s.renewals;
      acc.cancellations += s.cancellations;
      acc.expirations += s.expirations;
      acc.paused += s.paused;
      acc.resumed += s.resumed;
      acc.netGrowth += s.netGrowth;
      acc.activeSubscriptions = Math.max(
        acc.activeSubscriptions,
        s.activeSubscriptions,
      );
      return acc;
    },
    {
      newSubscriptions: 0,
      renewals: 0,
      cancellations: 0,
      expirations: 0,
      paused: 0,
      resumed: 0,
      activeSubscriptions: 0,
      netGrowth: 0,
    },
  );

  const last = rows[rows.length - 1];

  return {
    total: totals.newSubscriptions,
    open: totals.activeSubscriptions,
    paused: totals.paused,
    cancelled: totals.cancellations,
    expired: totals.expirations,
    freeTrial: 0,
    monthly: 0,
    yearly: 0,
    mrrCents: 0,
    avgSubscriptionDurationDays: 0,
    refreshedAt: last?.built_at ?? null,
    series,
    source: "daily_snapshots",
  };
}

export function mapDailyTrialSeries(
  rows: DailyTrialMetricRow[],
  groupBy: AnalyticsFilters["groupBy"] = "day",
): TrialAnalyticsResponse & {
  series: Array<{
    period: string;
    trialsStarted: number;
    trialsConverted: number;
    trialsExpired: number;
    conversionRate: number;
  }>;
  source: "daily_snapshots";
} {
  const buckets = new Map<
    string,
    { trialsStarted: number; trialsConverted: number; trialsExpired: number }
  >();
  for (const row of rows) {
    const key = periodKey(row.date, groupBy);
    const cur = buckets.get(key) ?? {
      trialsStarted: 0,
      trialsConverted: 0,
      trialsExpired: 0,
    };
    cur.trialsStarted += num(row.trials_started);
    cur.trialsConverted += num(row.trials_converted);
    cur.trialsExpired += num(row.trials_expired);
    buckets.set(key, cur);
  }
  const series = [...buckets.entries()].map(([period, v]) => ({
    period,
    ...v,
    conversionRate:
      v.trialsStarted > 0
        ? Number(((v.trialsConverted / v.trialsStarted) * 100).toFixed(2))
        : 0,
  }));
  const started = series.reduce((a, s) => a + s.trialsStarted, 0);
  const converted = series.reduce((a, s) => a + s.trialsConverted, 0);
  const expired = series.reduce((a, s) => a + s.trialsExpired, 0);
  return {
    totalTrials: started,
    activeTrials: 0,
    trialsExpiringSoon: 0,
    trialConversionsProxy: converted,
    trialConversionPct:
      started > 0 ? Number(((converted / started) * 100).toFixed(2)) : 0,
    refreshedAt: rows[rows.length - 1]?.built_at ?? null,
    series,
    source: "daily_snapshots",
  };
}

export function mapDailyPaymentSeries(
  rows: DailyPaymentMetricRow[],
  groupBy: AnalyticsFilters["groupBy"] = "day",
): PaymentAnalyticsResponse & {
  series: Array<{
    period: string;
    successfulPayments: number;
    failedPayments: number;
    recoveredPayments: number;
    paymentSuccessRate: number;
    revenueCents: number;
  }>;
  source: "daily_snapshots";
} {
  const buckets = new Map<
    string,
    {
      successfulPayments: number;
      failedPayments: number;
      recoveredPayments: number;
      revenueCents: number;
    }
  >();
  for (const row of rows) {
    const key = periodKey(row.date, groupBy);
    const cur = buckets.get(key) ?? {
      successfulPayments: 0,
      failedPayments: 0,
      recoveredPayments: 0,
      revenueCents: 0,
    };
    cur.successfulPayments += num(row.successful_payments);
    cur.failedPayments += num(row.failed_payments);
    cur.recoveredPayments += num(row.recovered_payments);
    cur.revenueCents += num(row.revenue_cents);
    buckets.set(key, cur);
  }
  const series = [...buckets.entries()].map(([period, v]) => ({
    period,
    ...v,
    paymentSuccessRate:
      v.successfulPayments + v.failedPayments > 0
        ? Number(
            (
              (v.successfulPayments /
                (v.successfulPayments + v.failedPayments)) *
              100
            ).toFixed(2),
          )
        : 0,
  }));
  const ok = series.reduce((a, s) => a + s.successfulPayments, 0);
  const fail = series.reduce((a, s) => a + s.failedPayments, 0);
  const recovered = series.reduce((a, s) => a + s.recoveredPayments, 0);
  const revenue = series.reduce((a, s) => a + s.revenueCents, 0);
  return {
    totalPayments: ok + fail,
    successfulPayments: ok,
    failedPayments: fail,
    recoveredPayments: recovered,
    revenueCents: revenue,
    refreshedAt: rows[rows.length - 1]?.built_at ?? null,
    series,
    source: "daily_snapshots",
  };
}

export function mapDailyProductSeries(
  rows: DailyProductMetricRow[],
): ProductAnalyticsResponse & { source: "daily_snapshots" } {
  const byProduct = new Map<
    string,
    {
      productId: string;
      name: string | null;
      subscribers: number;
      openSubscribers: number;
      revenueCents: number;
    }
  >();
  for (const row of rows) {
    const cur = byProduct.get(row.product_id) ?? {
      productId: row.product_id,
      name: row.product_name,
      subscribers: 0,
      openSubscribers: 0,
      revenueCents: 0,
    };
    cur.subscribers += num(row.new_subscribers);
    cur.openSubscribers = Math.max(
      cur.openSubscribers,
      num(row.active_subscribers),
    );
    cur.revenueCents += num(row.revenue);
    cur.name = row.product_name ?? cur.name;
    byProduct.set(row.product_id, cur);
  }
  return {
    products: [...byProduct.values()].map((p) => ({
      productId: p.productId,
      name: p.name,
      subscribers: p.subscribers,
      openSubscribers: p.openSubscribers,
      trials: 0,
      cancellations: 0,
      revenueCents: p.revenueCents,
      mrrContributionCents: 0,
      arrContributionCents: 0,
      cancellationPct: 0,
    })),
    refreshedAt: rows[rows.length - 1]?.built_at ?? null,
    source: "daily_snapshots",
  };
}

export function mapDailyCountrySeries(
  rows: DailyCountryMetricRow[],
): CountryAnalyticsResponse & { source: "daily_snapshots" } {
  const byCountry = new Map<
    string,
    {
      country: string;
      customerCount: number;
      openSubscriptionCount: number;
      mrrCents: number;
      revenueCents: number;
    }
  >();
  for (const row of rows) {
    const cur = byCountry.get(row.country) ?? {
      country: row.country,
      customerCount: 0,
      openSubscriptionCount: 0,
      mrrCents: 0,
      revenueCents: 0,
    };
    cur.customerCount += num(row.new_subscribers);
    cur.openSubscriptionCount = Math.max(
      cur.openSubscriptionCount,
      num(row.active_subscribers),
    );
    cur.revenueCents += num(row.revenue);
    byCountry.set(row.country, cur);
  }
  const countries = [...byCountry.values()];
  return {
    dimension: "country",
    total: countries.length,
    note: "From analytics.daily_country_metrics",
    countries,
    refreshedAt: rows[rows.length - 1]?.built_at ?? null,
    source: "daily_snapshots",
  };
}

export function mapDailyPlatformSeries(
  rows: DailyPlatformMetricRow[],
): PlatformAnalyticsResponse & { source: "daily_snapshots" } {
  const byPlatform = new Map<
    string,
    {
      platform: string;
      customerCount: number;
      openSubscriptionCount: number;
      mrrCents: number;
      revenueCents: number;
    }
  >();
  for (const row of rows) {
    const cur = byPlatform.get(row.platform) ?? {
      platform: row.platform,
      customerCount: 0,
      openSubscriptionCount: 0,
      mrrCents: 0,
      revenueCents: 0,
    };
    cur.customerCount += num(row.new_subscribers);
    cur.openSubscriptionCount = Math.max(
      cur.openSubscriptionCount,
      num(row.active_subscribers),
    );
    cur.revenueCents += num(row.revenue);
    byPlatform.set(row.platform, cur);
  }
  const platforms = [...byPlatform.values()];
  return {
    dimension: "platform",
    total: platforms.length,
    note: "From analytics.daily_platform_metrics",
    platforms,
    refreshedAt: rows[rows.length - 1]?.built_at ?? null,
    source: "daily_snapshots",
  };
}

export function mapDailyRevenueFromPayments(
  rows: DailyPaymentMetricRow[],
  groupBy: AnalyticsFilters["groupBy"] = "day",
): RevenueResponse {
  const mapped = mapDailyPaymentSeries(rows, groupBy);
  return {
    revenueCents: mapped.revenueCents,
    currency: null,
    note: "From analytics.daily_payment_metrics",
    totalRevenueCents: mapped.revenueCents,
    revenueTodayCents: 0,
    revenueWeekCents: 0,
    revenueMonthCents: 0,
    revenueYearCents: 0,
    series: mapped.series.map((s) => ({
      period: s.period,
      revenueCents: s.revenueCents,
    })),
    refreshedAt: mapped.refreshedAt,
  };
}

export function mapDailyUmbrella(input: {
  subscriptions: DailySubscriptionMetricRow[];
  trials: DailyTrialMetricRow[];
  payments: DailyPaymentMetricRow[];
  customers: DailyCustomerMetricRow[];
}): DailyAnalyticsResponse {
  return {
    subscriptions: input.subscriptions.map((r) => ({
      date: r.date,
      newSubscriptions: num(r.new_subscriptions),
      renewals: num(r.renewals),
      cancellations: num(r.cancellations),
      expirations: num(r.expirations),
      paused: num(r.paused),
      resumed: num(r.resumed),
      activeSubscriptions: num(r.active_subscriptions),
      netGrowth: num(r.net_growth),
      churnRate: num(r.churn_rate),
    })),
    trials: input.trials.map((r) => ({
      date: r.date,
      trialsStarted: num(r.trials_started),
      trialsConverted: num(r.trials_converted),
      trialsExpired: num(r.trials_expired),
      conversionRate: num(r.conversion_rate),
    })),
    payments: input.payments.map((r) => ({
      date: r.date,
      successfulPayments: num(r.successful_payments),
      failedPayments: num(r.failed_payments),
      recoveredPayments: num(r.recovered_payments),
      paymentSuccessRate: num(r.payment_success_rate),
      revenueCents: num(r.revenue_cents),
    })),
    customers: input.customers.map((r) => ({
      date: r.date,
      newCustomers: num(r.new_customers),
      activeCustomers: num(r.active_customers),
      returningCustomers: num(r.returning_customers),
    })),
    source: "daily_snapshots",
  };
}

export function defaultLast30DaysFilters(
  filters: AnalyticsFilters,
): AnalyticsFilters {
  if (hasHistoricalRange(filters)) return filters;
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    ...filters,
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    groupBy: filters.groupBy ?? "day",
  };
}
