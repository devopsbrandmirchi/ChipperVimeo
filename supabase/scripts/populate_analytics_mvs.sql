-- First populate of analytics MVs (non-concurrent).
-- Run via psql / Supabase direct connection if the SQL editor times out:
--   set statement_timeout = '0';
--   \i supabase/scripts/populate_analytics_mvs.sql
-- Or paste this file into the SQL editor one REFRESH block at a time.

set statement_timeout = '0';

refresh materialized view analytics.mv_dashboard;
refresh materialized view analytics.mv_daily_metrics;
refresh materialized view analytics.mv_monthly_metrics;
refresh materialized view analytics.mv_customer_metrics;
refresh materialized view analytics.mv_subscription_metrics;
refresh materialized view analytics.mv_product_metrics;
refresh materialized view analytics.mv_country_metrics;
refresh materialized view analytics.mv_platform_metrics;
refresh materialized view analytics.mv_revenue_metrics;
refresh materialized view analytics.mv_trial_metrics;
refresh materialized view analytics.mv_payment_metrics;
refresh materialized view analytics.mv_churn_metrics;
refresh materialized view analytics.mv_ltv_metrics;
