# Analytics Engine

Phase 9 + 9.5 — reporting layer with two complementary stores in the `analytics` schema.

## Architecture

```text
Webhook → vott_events → normalized public tables
                ↓
     MetricsBuilderService (idempotent)
                ↓
     analytics.daily_*  ← historical SoT (trends, charts, exports, cohorts)
     analytics.mv_*     ← current KPI cache (dashboard cards)
                ↓
     Analytics APIs → Dashboard
```

**Never** query `public.vott_events` for analytics.  
**Do not** increment counters in the webhook pipeline.  
**Do not** depend on Phase 2 `public.vw_*` placeholders from app code.

| Layer | Responsibility |
|-------|----------------|
| `analytics.daily_*` | Historical date-based reporting |
| `analytics.mv_*` | Current point-in-time KPI cards |

## Migrations (additive)

| File | Purpose |
|------|---------|
| `012`–`018` | Schema, helpers, `mv_*`, refresh/query RPCs, grants |
| `019_analytics_daily_snapshot_tables.sql` | `daily_*` snapshot tables |
| `020_analytics_daily_snapshot_indexes.sql` | Snapshot + builder support indexes |
| `021_analytics_daily_build_functions.sql` | `build_daily_snapshots(date)`, `earliest_metrics_date()` |

Existing `001`–`011` are unchanged.

**SQL editor timeouts:** `014` creates empty MVs (`WITH NO DATA`). Populate via [`supabase/scripts/populate_analytics_mvs.sql`](../supabase/scripts/populate_analytics_mvs.sql).

## Materialized views (current KPIs)

| View | Role |
|------|------|
| `mv_dashboard` | Single-row KPI snapshot |
| `mv_*` others | Current aggregates for cards / non-ranged GETs |

Legacy `mv_daily_metrics` may still exist; **prefer `daily_*` tables** for historical series.

## Daily snapshot tables (historical)

| Table | Grain |
|-------|-------|
| `daily_subscription_metrics` | date |
| `daily_trial_metrics` | date |
| `daily_payment_metrics` | date |
| `daily_customer_metrics` | date |
| `daily_product_metrics` | date + product_id |
| `daily_country_metrics` | date + country |
| `daily_platform_metrics` | date + platform |

Built only from `customers`, `subscriptions`, `payments`, `subscription_events`. Rebuilds overwrite snapshot rows only.

## Metrics Catalog

Typed definitions (no I/O) in [`src/modules/analytics/metrics/`](../src/modules/analytics/metrics/).

## Build & refresh

### Daily snapshots (Phase 9.5)

```sql
select analytics.build_daily_snapshots('2026-07-01'::date);
```

HTTP (ADMIN):

```http
POST /api/v1/analytics/daily/build
{ "date": "2026-07-01" }
{ "dateFrom": "2026-01-01", "dateTo": "2026-07-01" }
{ "mode": "all" }
```

Idempotent: rebuilding the same day always recomputes from operational tables.

### MV KPI cache (Phase 9)

```sql
select analytics.refresh_all();
```

```http
POST /api/v1/analytics/refresh
{ "target": "all" }
```

No cron in this phase.

## API

| Method | Path | Source |
|--------|------|--------|
| GET | `/dashboard`, `/overview`, `/mrr`, `/arr` | `mv_*` (current) |
| GET | `/subscriptions`, `/trials`, `/payments`, `/products`, `/countries`, `/platforms`, `/revenue` | `mv_*` if no date range; **`daily_*` when `date` / `dateFrom` / `dateTo` present** |
| GET | `/daily` | Always `daily_*` (default last 30 days) |
| POST | `/daily/build` | ADMIN — MetricsBuilder |
| POST | `/refresh` | ADMIN — MV refresh |

Shared query params: `date`, `dateFrom`, `dateTo`, `country`, `platform`, `productId`, `billingCycle`, `status`, `groupBy`, `limit`.

## Module path

```text
src/modules/analytics/
  metrics/  metrics-builder/  dto/  mappers/
  repository/  service/  controller/  types/
```

Wired from [`src/lib/api/service-container.ts`](../src/lib/api/service-container.ts) (`analytics` + `metricsBuilder`).

## Ops checklist

1. Apply migrations `012`–`021`.
2. **Expose the schema to the API** (required or you get `Invalid schema: analytics`):
   - Supabase Dashboard → **Integrations → Data API → Exposed schemas**
   - Add `analytics` alongside `public`
3. Populate MVs: [`supabase/scripts/populate_analytics_mvs.sql`](../supabase/scripts/populate_analytics_mvs.sql)
4. Build daily snapshots: `POST /api/v1/analytics/daily/build` with `{ "mode": "all" }` (or SQL loop)
5. Confirm: `select * from analytics.mv_dashboard;` and `select * from analytics.daily_subscription_metrics order by date desc limit 5;`

### Troubleshooting

| Error | Cause | Fix |
|-------|--------|-----|
| `Invalid schema: analytics` | Schema not in Exposed schemas | Step 2 |
| Empty / zero KPI cards | MVs never populated | Step 3 |
| Empty historical series | Daily snapshots never built | Step 4 |
| `REFRESH … CONCURRENTLY` fails | First MV fill missing | Non-concurrent populate, ensure `015` |
