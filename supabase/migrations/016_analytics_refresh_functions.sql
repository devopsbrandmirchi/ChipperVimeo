-- Phase 9: manual refresh functions (no cron).

create or replace function analytics.refresh_dashboard()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_dashboard;
end;
$$;

create or replace function analytics.refresh_daily_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_daily_metrics;
end;
$$;

create or replace function analytics.refresh_monthly_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  -- Depends on daily MV contents at refresh time.
  refresh materialized view concurrently analytics.mv_monthly_metrics;
end;
$$;

create or replace function analytics.refresh_customer_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_customer_metrics;
end;
$$;

create or replace function analytics.refresh_subscription_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_subscription_metrics;
end;
$$;

create or replace function analytics.refresh_product_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_product_metrics;
end;
$$;

create or replace function analytics.refresh_country_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_country_metrics;
end;
$$;

create or replace function analytics.refresh_platform_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_platform_metrics;
end;
$$;

create or replace function analytics.refresh_revenue_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_revenue_metrics;
end;
$$;

create or replace function analytics.refresh_trial_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_trial_metrics;
end;
$$;

create or replace function analytics.refresh_payment_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_payment_metrics;
end;
$$;

create or replace function analytics.refresh_churn_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  refresh materialized view concurrently analytics.mv_churn_metrics;
end;
$$;

create or replace function analytics.refresh_ltv_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  -- Depends on mv_customer_metrics.
  refresh materialized view concurrently analytics.mv_ltv_metrics;
end;
$$;

create or replace function analytics.refresh_all()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  perform analytics.refresh_dashboard();
  perform analytics.refresh_daily_metrics();
  perform analytics.refresh_monthly_metrics();
  perform analytics.refresh_customer_metrics();
  perform analytics.refresh_subscription_metrics();
  perform analytics.refresh_product_metrics();
  perform analytics.refresh_country_metrics();
  perform analytics.refresh_platform_metrics();
  perform analytics.refresh_revenue_metrics();
  perform analytics.refresh_trial_metrics();
  perform analytics.refresh_payment_metrics();
  perform analytics.refresh_churn_metrics();
  perform analytics.refresh_ltv_metrics();
end;
$$;

grant execute on function analytics.refresh_dashboard() to service_role;
grant execute on function analytics.refresh_daily_metrics() to service_role;
grant execute on function analytics.refresh_monthly_metrics() to service_role;
grant execute on function analytics.refresh_customer_metrics() to service_role;
grant execute on function analytics.refresh_subscription_metrics() to service_role;
grant execute on function analytics.refresh_product_metrics() to service_role;
grant execute on function analytics.refresh_country_metrics() to service_role;
grant execute on function analytics.refresh_platform_metrics() to service_role;
grant execute on function analytics.refresh_revenue_metrics() to service_role;
grant execute on function analytics.refresh_trial_metrics() to service_role;
grant execute on function analytics.refresh_payment_metrics() to service_role;
grant execute on function analytics.refresh_churn_metrics() to service_role;
grant execute on function analytics.refresh_ltv_metrics() to service_role;
grant execute on function analytics.refresh_all() to service_role;
