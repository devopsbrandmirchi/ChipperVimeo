export type DashboardResponse = {
  totalCustomers: number;
  newCustomersToday: number;
  activeSubscribers: number;
  paused: number;
  cancelled: number;
  expired: number;
  freeTrials: number;
  renewalsToday: number;
  chargeFailures: number;
  recoveredPayments: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  revenueYearCents: number;
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  arppuProxyCents: number;
  trialConversionPct: number;
  churnRatePct: number;
  retentionRatePct: number;
  paymentRecoveryRatePct: number;
  refreshedAt: string | null;
};

export type RevenueResponse = {
  /** Phase 8 compatible */
  revenueCents: number;
  currency: string | null;
  note: string;
  totalRevenueCents: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  revenueYearCents: number;
  series: Array<{ period: string; revenueCents: number }>;
  refreshedAt: string | null;
};

export type CustomerAnalyticsResponse = {
  activeSubscribers: number;
  totalCustomers: number;
  topLtv: Array<{
    customerId: string;
    email: string | null;
    lifetimeRevenueCents: number;
    country: string | null;
    platform: string | null;
  }>;
  inTrial: Array<{ customerId: string; email: string | null }>;
  failedPayments: Array<{
    customerId: string;
    email: string | null;
    failedPaymentCount: number;
  }>;
  recentlyCancelled: Array<{ customerId: string; email: string | null }>;
  byCountry: Array<{ country: string; customerCount: number; revenueCents: number }>;
  byPlatform: Array<{
    platform: string;
    customerCount: number;
    revenueCents: number;
  }>;
  refreshedAt: string | null;
};

export type SubscriptionAnalyticsResponse = {
  total: number;
  open: number;
  paused: number;
  cancelled: number;
  expired: number;
  freeTrial: number;
  monthly: number;
  yearly: number;
  mrrCents: number;
  avgSubscriptionDurationDays: number;
  refreshedAt: string | null;
};

export type ProductAnalyticsResponse = {
  products: Array<{
    productId: string;
    name: string | null;
    subscribers: number;
    openSubscribers: number;
    trials: number;
    cancellations: number;
    revenueCents: number;
    mrrContributionCents: number;
    arrContributionCents: number;
    cancellationPct: number;
  }>;
  refreshedAt: string | null;
};

export type CountryAnalyticsResponse = {
  /** Phase 8 compatible */
  dimension: string;
  total: number;
  note: string;
  countries: Array<{
    country: string;
    customerCount: number;
    openSubscriptionCount: number;
    mrrCents: number;
    revenueCents: number;
  }>;
  refreshedAt: string | null;
};

export type PlatformAnalyticsResponse = {
  /** Phase 8 compatible */
  dimension: string;
  total: number;
  note: string;
  platforms: Array<{
    platform: string;
    customerCount: number;
    openSubscriptionCount: number;
    mrrCents: number;
    revenueCents: number;
  }>;
  refreshedAt: string | null;
};

export type PaymentAnalyticsResponse = {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  recoveredPayments: number;
  revenueCents: number;
  refreshedAt: string | null;
};

export type TrialAnalyticsResponse = {
  totalTrials: number;
  activeTrials: number;
  trialsExpiringSoon: number;
  trialConversionsProxy: number;
  trialConversionPct: number;
  refreshedAt: string | null;
};

export type ChurnAnalyticsResponse = {
  cancelledTotal: number;
  cancelledThisMonth: number;
  retainedOpen: number;
  churnRatePct: number;
  retentionRatePct: number;
  refreshedAt: string | null;
};

export type MRRResponse = {
  mrrCents: number;
  arrCents: number;
  refreshedAt: string | null;
};

export type ARRResponse = {
  arrCents: number;
  mrrCents: number;
  refreshedAt: string | null;
};

export type LTVResponse = {
  avgLtvCents: number;
  medianLtvCents: number;
  maxLtvCents: number;
  payingCustomers: number;
  refreshedAt: string | null;
};

/** Umbrella historical daily payload (GET /analytics/daily). */
export type DailyAnalyticsResponse = {
  subscriptions: Array<{
    date: string;
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
  trials: Array<{
    date: string;
    trialsStarted: number;
    trialsConverted: number;
    trialsExpired: number;
    conversionRate: number;
  }>;
  payments: Array<{
    date: string;
    successfulPayments: number;
    failedPayments: number;
    recoveredPayments: number;
    paymentSuccessRate: number;
    revenueCents: number;
  }>;
  customers: Array<{
    date: string;
    newCustomers: number;
    activeCustomers: number;
    returningCustomers: number;
  }>;
  source: "daily_snapshots";
};

/** Gain/loss reporting from subscription_events (Phase 9.5). */
export type SubscriptionGainLossTotals = {
  subscriptionGain: number;
  subscriptionLoss: number;
  trialGain: number;
  trialLoss: number;
  trialConversion: number;
  combinedGain: number;
  combinedLoss: number;
  uniqueCustomersGain: number;
  uniqueCustomersLoss: number;
  conversionRate: number;
};

export type SubscriptionGainLossRow = SubscriptionGainLossTotals & {
  key: string;
  label: string;
  reportDate?: string;
  platform?: string;
  country?: string;
  productId?: string;
};

export type SubscriptionMetricsResponse = {
  startDate: string;
  endDate: string;
  preset: string;
  totals: SubscriptionGainLossTotals;
  series: SubscriptionGainLossRow[];
  byPlatform: SubscriptionGainLossRow[];
  byCountry: SubscriptionGainLossRow[];
  byProduct: SubscriptionGainLossRow[];
  byDayCountry: SubscriptionGainLossRow[];
  source: "subscription_events";
};

/** Phase 8 compatible overview shape (additive fields allowed later). */
export type AnalyticsOverview = {
  activeSubscribers: number;
  cancelledSubscriptions: number;
  trialSubscriptions: number;
  revenue: {
    revenueCents: number;
    currency: string | null;
    note: string;
  };
  countries: { dimension: string; total: number; note: string };
  platforms: { dimension: string; total: number; note: string };
};
