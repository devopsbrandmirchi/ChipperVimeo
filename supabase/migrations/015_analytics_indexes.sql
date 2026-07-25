-- Phase 9: unique indexes required for REFRESH MATERIALIZED VIEW CONCURRENTLY.

create unique index if not exists mv_dashboard_id_uidx
  on analytics.mv_dashboard (id);

create unique index if not exists mv_daily_metrics_date_uidx
  on analytics.mv_daily_metrics (metric_date);

create unique index if not exists mv_monthly_metrics_month_uidx
  on analytics.mv_monthly_metrics (metric_month);

create unique index if not exists mv_customer_metrics_id_uidx
  on analytics.mv_customer_metrics (customer_id);

create unique index if not exists mv_subscription_metrics_id_uidx
  on analytics.mv_subscription_metrics (id);

create unique index if not exists mv_product_metrics_id_uidx
  on analytics.mv_product_metrics (product_id);

create unique index if not exists mv_country_metrics_country_uidx
  on analytics.mv_country_metrics (country);

create unique index if not exists mv_platform_metrics_platform_uidx
  on analytics.mv_platform_metrics (platform);

create unique index if not exists mv_revenue_metrics_id_uidx
  on analytics.mv_revenue_metrics (id);

create unique index if not exists mv_trial_metrics_id_uidx
  on analytics.mv_trial_metrics (id);

create unique index if not exists mv_payment_metrics_id_uidx
  on analytics.mv_payment_metrics (id);

create unique index if not exists mv_churn_metrics_id_uidx
  on analytics.mv_churn_metrics (id);

create unique index if not exists mv_ltv_metrics_id_uidx
  on analytics.mv_ltv_metrics (id);

create index if not exists mv_customer_metrics_ltv_idx
  on analytics.mv_customer_metrics (lifetime_revenue_cents desc);

create index if not exists mv_customer_metrics_country_idx
  on analytics.mv_customer_metrics (country);

create index if not exists mv_customer_metrics_platform_idx
  on analytics.mv_customer_metrics (platform);

create index if not exists mv_daily_metrics_revenue_idx
  on analytics.mv_daily_metrics (metric_date, revenue_cents);
