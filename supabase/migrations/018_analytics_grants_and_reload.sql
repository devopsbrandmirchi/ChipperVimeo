-- Phase 9: grants + PostgREST reload.
-- Ops: after deploy / bulk ingest, run: select analytics.refresh_all();
--
-- Initial populate is intentionally NOT in this migration — the Supabase SQL
-- editor has an upstream timeout. After 012–018 apply, populate via one of:
--   1) Database → Connect → psql / connection string, then run the block below
--   2) SQL editor: one REFRESH at a time
--   3) ADMIN POST /api/v1/analytics/refresh after first non-concurrent fill
--
-- First fill must be non-concurrent (empty MVs). Concurrent refresh needs
-- unique indexes from 015 and a prior successful populate.

grant select on all tables in schema analytics to service_role;
grant select on all tables in schema analytics to authenticated;

alter default privileges in schema analytics
  grant select on tables to service_role;

alter default privileges in schema analytics
  grant select on tables to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Manual first populate (run outside SQL editor if large, or one-by-one):
--
-- set statement_timeout = '0';
-- refresh materialized view analytics.mv_dashboard;
-- refresh materialized view analytics.mv_daily_metrics;
-- refresh materialized view analytics.mv_monthly_metrics;
-- refresh materialized view analytics.mv_customer_metrics;
-- refresh materialized view analytics.mv_subscription_metrics;
-- refresh materialized view analytics.mv_product_metrics;
-- refresh materialized view analytics.mv_country_metrics;
-- refresh materialized view analytics.mv_platform_metrics;
-- refresh materialized view analytics.mv_revenue_metrics;
-- refresh materialized view analytics.mv_trial_metrics;
-- refresh materialized view analytics.mv_payment_metrics;
-- refresh materialized view analytics.mv_churn_metrics;
-- refresh materialized view analytics.mv_ltv_metrics;
-- ---------------------------------------------------------------------------
