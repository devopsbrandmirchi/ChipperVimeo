/** Row shapes for analytics.daily_* snapshot tables. */

export type DailySubscriptionMetricRow = {
  date: string;
  new_subscriptions: number;
  renewals: number;
  cancellations: number;
  expirations: number;
  paused: number;
  resumed: number;
  active_subscriptions: number;
  net_growth: number;
  churn_rate: number;
  built_at: string | null;
};

export type DailyTrialMetricRow = {
  date: string;
  trials_started: number;
  trials_converted: number;
  trials_expired: number;
  conversion_rate: number;
  built_at: string | null;
};

export type DailyPaymentMetricRow = {
  date: string;
  successful_payments: number;
  failed_payments: number;
  recovered_payments: number;
  payment_success_rate: number;
  revenue_cents: number;
  built_at: string | null;
};

export type DailyCustomerMetricRow = {
  date: string;
  new_customers: number;
  active_customers: number;
  returning_customers: number;
  built_at: string | null;
};

export type DailyProductMetricRow = {
  date: string;
  product_id: string;
  product_name: string | null;
  active_subscribers: number;
  new_subscribers: number;
  revenue: number;
  built_at: string | null;
};

export type DailyCountryMetricRow = {
  date: string;
  country: string;
  active_subscribers: number;
  new_subscribers: number;
  revenue: number;
  built_at: string | null;
};

export type DailyPlatformMetricRow = {
  date: string;
  platform: string;
  active_subscribers: number;
  new_subscribers: number;
  revenue: number;
  built_at: string | null;
};
