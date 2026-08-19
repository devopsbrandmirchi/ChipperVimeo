export type DashboardRow = {
  id: number;
  total_customers: number;
  new_customers_today: number;
  active_subscribers: number;
  paused_subscriptions: number;
  cancelled_subscriptions: number;
  expired_subscriptions: number;
  free_trial_subscriptions: number;
  renewals_today: number;
  /** Present after migration 034; treat missing as 0. */
  cancelled_today?: number;
  charge_failures: number;
  recovered_payments: number;
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
  revenue_year_cents: number;
  mrr_cents: number;
  arr_cents: number;
  arpu_cents: number;
  arppu_proxy_cents: number;
  trial_conversion_pct: number;
  churn_rate_pct: number;
  retention_rate_pct: number;
  payment_recovery_rate_pct: number;
  refreshed_at: string;
};

export type DailyMetricRow = {
  metric_date: string;
  new_customers: number;
  new_subscriptions: number;
  new_trials: number;
  cancellations: number;
  payment_attempts: number;
  successful_payments: number;
  failed_payments: number;
  revenue_cents: number;
  refreshed_at: string;
};

export type MonthlyMetricRow = {
  metric_month: string;
  new_customers: number;
  new_subscriptions: number;
  new_trials: number;
  cancellations: number;
  payment_attempts: number;
  successful_payments: number;
  failed_payments: number;
  revenue_cents: number;
  refreshed_at: string;
};

export type CustomerMetricRow = {
  customer_id: string;
  email: string | null;
  country: string | null;
  platform: string | null;
  lifetime_revenue_cents: number;
  failed_payment_count: number;
  in_trial: boolean;
  recently_cancelled: boolean;
  refreshed_at: string;
};

export type SubscriptionMetricRow = {
  id: number;
  total_subscriptions: number;
  open_subscriptions: number;
  paused_subscriptions: number;
  cancelled_subscriptions: number;
  expired_subscriptions: number;
  free_trial_subscriptions: number;
  monthly_subscriptions: number;
  yearly_subscriptions: number;
  mrr_cents: number;
  avg_subscription_duration_days: number;
  refreshed_at: string;
};

export type ProductMetricRow = {
  product_id: string;
  product_name: string | null;
  subscribers: number;
  open_subscribers: number;
  trials: number;
  cancellations: number;
  mrr_contribution_cents: number;
  arr_contribution_cents: number;
  revenue_cents: number;
  cancellation_pct: number;
  refreshed_at: string;
};

export type CountryMetricRow = {
  country: string;
  customer_count: number;
  open_subscription_count: number;
  mrr_cents: number;
  revenue_cents: number;
  refreshed_at: string;
};

export type PlatformMetricRow = {
  platform: string;
  customer_count: number;
  open_subscription_count: number;
  mrr_cents: number;
  revenue_cents: number;
  refreshed_at: string;
};

export type PaymentMetricRow = {
  id: number;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  recovered_payments: number;
  revenue_cents: number;
  refreshed_at: string;
};

export type TrialMetricRow = {
  id: number;
  total_trials: number;
  active_trials: number;
  trials_expiring_soon: number;
  trial_conversions_proxy: number;
  refreshed_at: string;
};

export type ChurnMetricRow = {
  id: number;
  cancelled_total: number;
  cancelled_this_month: number;
  retained_open: number;
  churn_rate_pct: number;
  refreshed_at: string;
};

export type LtvMetricRow = {
  id: number;
  avg_ltv_cents: number;
  max_ltv_cents: number;
  median_ltv_cents: number;
  paying_customers: number;
  refreshed_at: string;
};

export type RevenueMetricRow = {
  id: number;
  total_revenue_cents: number;
  successful_payment_count: number;
  avg_payment_cents: number;
  refreshed_at: string;
};
