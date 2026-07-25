# REST API (`/api/v1`)

Phase 6 — read-only versioned HTTP API over domain services. Vimeo OTT remains the source of truth; there are **no** POST/PUT/PATCH/DELETE business endpoints.

**Unauthenticated in this phase** — protect before any production exposure.

## Architecture

```text
Client → Route Handler → Domain Service → Repository → Supabase
```

Controllers never query Supabase. Shared response/pagination types live under `src/types/` (framework-agnostic). Next.js wrappers live under `src/app/api/v1/_shared/`. Composition root: [`src/lib/api/service-container.ts`](../src/lib/api/service-container.ts).

Preserved (not under `/api/v1`):

- `POST /api/webhooks/vimeo`
- `/api/auth/*`

Obsolete unversioned stubs (`/api/customers`, `/api/subscriptions`, `/api/webhook-events`) were removed.

## Response envelope

Success:

```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Invalid request",
  "errors": [{ "code": "invalid_type", "message": "...", "path": "page" }]
}
```

| Status | When |
|--------|------|
| 400 | Zod / invalid query or path params |
| 404 | Entity not found |
| 409 | Duplicate (rare on GET) |
| 422 | Service validation / business rule |
| 500 | Unexpected |

Every response includes `x-request-id` (incoming header or generated UUID).

## Pagination

Common query params on list endpoints:

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | ≥ 1 |
| `pageSize` | 25 | 1–200 |
| `sort` | resource default | allowlisted per resource |
| `direction` | `desc` | `asc` \| `desc` |
| `search` | — | where supported |

`meta` is present on paginated list responses.

### 200-candidate limitation

Equality filters use exact DB pagination via repositories. Text search, date ranges, and multi-filter compositions fetch **at most 200 candidates**, filter in memory, then page that set. Totals for those queries reflect the candidate window, not the full table. Documented per filter below.

## Endpoints

### Domain

#### `GET /api/v1/customers`

Filters: `status`, `subscriptionStatus`, `country`, `platform`, `plan`, `productId`, `signupFrom`, `signupTo`, `search`.

Sort: `created_at`, `updated_at`, `last_seen_at`, `email`, `full_name`, `country`, `platform` (default `created_at`).

Notes:

- `search` / signup range / `productId` use the ≤200 candidate path.
- `productId` cannot join customer→subscription without repo changes — **ignored** (filter accepted, no effect).

#### `GET /api/v1/customers/[id]`

UUID path param.

#### `GET /api/v1/subscriptions`

Filters: `status`, `billingFrequency`, `productId`, `customerId`, `trial` (`true`\|`false`), `renewalFrom`, `renewalTo`.

Sort: `created_at`, `started_at`, `renewal_date`, `next_payment_date`, `status` (default `started_at`).

`trial` / renewal range → ≤200 candidate path.

#### `GET /api/v1/subscriptions/[id]`

#### `GET /api/v1/products`

Filters: `active` (`true`\|`false`), `sku`, `name`, `search`.

Sort: `created_at`, `name`, `updated_at`, `sku`.

#### `GET /api/v1/products/[id]`

#### `GET /api/v1/payments`

Filters: `status`, `customerId`, `subscriptionId`, `currency`, `from`, `to`.

Sort: `created_at`, `payment_date`, `amount_cents`, `status`.

Date range / currency compositions → ≤200 candidate path.

#### `GET /api/v1/payments/[id]`

#### `GET /api/v1/webhook-events`

Read-only ingest log (includes raw payload). Filters: `topic`, `customerId` (Vimeo numeric id), `email`, `productId` (Vimeo numeric id), `from`, `to`.

Sort: `received_at`, `event_created_at`, `topic` (default `received_at` desc).

Filtered lists → ≤200 candidate path.

#### `GET /api/v1/webhook-events/[id]`

#### `GET /api/v1/timeline/[customerId]`

Full subscription lifecycle for a customer UUID, ordered ascending. Not paginated.

### Analytics

Two layers in the `analytics` schema — see [`docs/analytics-engine.md`](analytics-engine.md):

- **`mv_*`** — current KPI cards (`/dashboard`, `/overview`, `/mrr`, `/arr`, and domain GETs **without** a date range)
- **`daily_*`** — historical SoT when `date` / `dateFrom` / `dateTo` are present (and always for `/daily`)

| Endpoint | Returns |
|----------|---------|
| `GET /api/v1/analytics/dashboard` | Full KPI snapshot (MRR, ARR, churn, revenue windows, …) |
| `GET /api/v1/analytics/overview` | Phase 8–compatible overview (backed by dashboard MV) |
| `GET /api/v1/analytics/revenue` | Revenue totals + series (`dateFrom`/`dateTo`/`groupBy` → `daily_payment_metrics`) |
| `GET /api/v1/analytics/customers` | Customer analytics segments + dimension rollups |
| `GET /api/v1/analytics/subscriptions` | Current MV totals, or daily subscription series with date range |
| `GET /api/v1/analytics/products` | Current or historical product metrics |
| `GET /api/v1/analytics/countries` | Current or historical country breakdown |
| `GET /api/v1/analytics/platforms` | Current or historical platform breakdown |
| `GET /api/v1/analytics/payments` | Current or historical payment metrics |
| `GET /api/v1/analytics/trials` | Current or historical trial metrics |
| `GET /api/v1/analytics/daily` | Umbrella daily series (default last 30 days) from `daily_*` |
| `GET /api/v1/analytics/churn` | Churn / retention (MV) |
| `GET /api/v1/analytics/mrr` | MRR (+ ARR) |
| `GET /api/v1/analytics/arr` | ARR (+ MRR) |
| `POST /api/v1/analytics/refresh` | ADMIN — refresh MVs (`{ "target": "all" }`) |
| `POST /api/v1/analytics/daily/build` | ADMIN — `{ "date" }` \| `{ "dateFrom","dateTo" }` \| `{ "mode":"all" }` |

Auth required (cookie session). Never derived from `vott_events`.

### Operations

#### `GET /api/v1/health`

```json
{
  "success": true,
  "message": "Health check successful",
  "data": { "status": "ok", "version": "0.1.0", "time": "..." }
}
```

No database query — process status only.

## Policy

1. **GET-only** for business resources under `/api/v1`.
2. Controllers call **services only**.
3. Repositories stay frozen (ports widened; classes unchanged).
4. Do not expose stacks or raw Supabase errors to clients.
