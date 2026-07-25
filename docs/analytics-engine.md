# Analytics Engine

Phase 9 — reporting layer. Single source of truth for dashboards, KPIs, exports, and BI.

## Architecture

```text
public normalized tables
        ↓
analytics schema (materialized views)
        ↓
AnalyticsRepository  (.schema("analytics"))
        ↓
AnalyticsService + Metrics Catalog
        ↓
GET /api/v1/analytics/*
```

**Never** query `public.vott_events` for analytics.  
**Do not** depend on Phase 2 `public.vw_*` placeholders from app code.

## Migrations (additive)

| File | Purpose |
|------|---------|
| `012_create_analytics_schema.sql` | `analytics` schema |
| `013_analytics_helper_views.sql` | Helper views over public tables |
| `014_analytics_materialized_views.sql` | All `mv_*` (`WITH NO DATA` — fast DDL) |
| `015_analytics_indexes.sql` | Unique indexes for concurrent refresh |
| `016_analytics_refresh_functions.sql` | `refresh_*` + `refresh_all` |
| `017_analytics_query_functions.sql` | Filtered RPCs |
| `018_analytics_grants_and_reload.sql` | Grants + schema reload |

Existing `001`–`011` are unchanged.

**SQL editor timeouts:** `014` creates empty MVs so it does not compute aggregates in the editor. After `012`–`018`, populate once (non-concurrent) via psql / direct connection, or refresh one MV at a time in the editor. Then use `analytics.refresh_all()` / ADMIN HTTP for later concurrent refreshes.

## Materialized views

| View | Role |
|------|------|
| `mv_dashboard` | Single-row KPI snapshot |
| `mv_daily_metrics` / `mv_monthly_metrics` | Time series |
| `mv_customer_metrics` | Per-customer LTV / trial / failures |
| `mv_subscription_metrics` | Subscription status aggregates |
| `mv_product_metrics` | Per-product contribution |
| `mv_country_metrics` / `mv_platform_metrics` | Dimensions |
| `mv_revenue_metrics` / `mv_payment_metrics` / `mv_trial_metrics` | Domain snapshots |
| `mv_churn_metrics` / `mv_ltv_metrics` | Churn + LTV |

## Metrics Catalog

Typed definitions (no I/O) in [`src/modules/analytics/metrics/`](../src/modules/analytics/metrics/):

- `mrr`, `arr`, `churn`, `ltv`, `arpu`, `trial_conversion`, `retention`, `revenue`, `subscriptions`

SQL computes values into MVs; the catalog documents id, formula, unit, and source columns.

## Refresh (manual only)

**First populate** (after migrations; empty MVs from `WITH NO DATA`):

```sql
-- Prefer direct connection / psql if the SQL editor times out:
-- see supabase/scripts/populate_analytics_mvs.sql
set statement_timeout = '0';
refresh materialized view analytics.mv_dashboard;
-- …remaining MVs in that script…
```

**Later refreshes:**

```sql
select analytics.refresh_all();
-- or
select analytics.refresh_dashboard();
```

HTTP (ADMIN role):

```http
POST /api/v1/analytics/refresh
{ "target": "all" }
```

No cron in this phase. Concurrent refresh requires unique indexes (`015`) and a prior successful populate.

## API

| Method | Path |
|--------|------|
| GET | `/api/v1/analytics/dashboard` |
| GET | `/api/v1/analytics/overview` (Phase 8 compatible) |
| GET | `/api/v1/analytics/revenue` |
| GET | `/api/v1/analytics/customers` |
| GET | `/api/v1/analytics/subscriptions` |
| GET | `/api/v1/analytics/products` |
| GET | `/api/v1/analytics/countries` |
| GET | `/api/v1/analytics/platforms` |
| GET | `/api/v1/analytics/payments` |
| GET | `/api/v1/analytics/trials` |
| GET | `/api/v1/analytics/churn` |
| GET | `/api/v1/analytics/mrr` |
| GET | `/api/v1/analytics/arr` |
| POST | `/api/v1/analytics/refresh` |

Shared query params (where applicable): `dateFrom`, `dateTo`, `country`, `platform`, `productId`, `billingCycle`, `status`, `groupBy`, `limit`.

## Module path

```text
src/modules/analytics/
  metrics/  dto/  mappers/  repository/  service/  controller/  types/
```

Wired from [`src/lib/api/service-container.ts`](../src/lib/api/service-container.ts).

## Ops checklist

1. Apply migrations `012`–`018`.
2. Run `select analytics.refresh_all();` after bulk ingest.
3. Confirm `select * from analytics.mv_dashboard;`.
