# Repository Layer

Enterprise data-access layer for the Vimeo OTT Customer Subscription Analytics Platform (Phase 3).

## Repository Pattern

```text
Controller / API
      ↓
Service Layer          ← Phase 4+
      ↓
Repository Layer       ← this document
      ↓
Supabase (PostgreSQL)
```

Repositories are the **only** layer allowed to run database queries. They:

- Read and write rows
- Map Supabase/PostgREST failures to `RepositoryError`
- Expose typed return values

They must **not**:

- Contain business / lifecycle rules
- Know about HTTP, React, or webhooks beyond storing `vott_events` rows
- Compute analytics
- Call other services

## Responsibilities

| Repository | Table | Notes |
|------------|-------|-------|
| `CustomerRepository` | `customers` | Upsert by `vimeo_customer_id`; search; snapshot patches |
| `ProductRepository` | `products` | Upsert by `vimeo_product_id`; active/inactive |
| `SubscriptionRepository` | `subscriptions` | Open / cancelled / expired; `findCurrent` |
| `SubscriptionEventRepository` | `subscription_events` | Append-only; timeline |
| `PaymentRepository` | `payments` | By customer, status, date range |
| `VottEventRepository` | `vott_events` | Immutable ingest store; pending derived |
| `BaseRepository` | — | Shared CRUD, count, exists, paginate |

Optional `SupabaseClient` constructor argument reuses [`createServiceClient()`](../src/lib/supabase/server.ts) when omitted.

## Method conventions

- `find*` — return `T | null` or `T[]`; never throw for empty results
- `create` / `insert` / `upsert` — return the persisted row
- `update` — throw `NotFound` if the id does not exist
- `delete` — throw `NotFound` if nothing was deleted
- `count` / `exists` / `paginate` — shared via `BaseRepository`
- `search` — soft filters (`ilike` / `eq`) with a hard limit (max 200)

No method returns `any`. Entity shapes live in [`src/types/database.ts`](../src/types/database.ts); webhook event shapes remain in [`src/types/vimeo.ts`](../src/types/vimeo.ts).

## Pagination

```ts
type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
```

Defaults: `page = 1`, `pageSize = 50`, max page size `200`. Uses PostgREST `{ count: "exact" }` + `.range()`.

## Error handling

All failures become [`RepositoryError`](../src/types/errors.ts):

| Code | When |
|------|------|
| `NotFound` | Missing row / PGRST116 |
| `UniqueViolation` | Postgres `23505` |
| `ForeignKeyViolation` | Postgres `23503` |
| `CheckViolation` | Postgres `23514` |
| `DatabaseError` | Other PostgREST/DB errors |
| `NotSupported` | Operation blocked by missing schema (e.g. `markFailed`) |

Callers must never see raw Supabase `PostgrestError` objects.

## Webhook processing status (no schema columns)

`vott_events` has no `processing_status` / `processed_at` / `error` columns (schema frozen in Phase 3).

| Method | Behavior |
|--------|----------|
| `findPending` | Events with **no** `subscription_events.vott_event_id` match |
| `findFailed` | Always `[]` |
| `markProcessed` | No-op — processed = presence of a `subscription_events` row |
| `markFailed` | Throws `NotSupported` |

A future migration may add status columns; until then Phase 4 processors should treat `subscription_events` inserts as the success marker.

## Future transaction support

Supabase JS does not expose multi-statement transactions on the client.

Designed hooks:

1. Every repository accepts an optional shared `SupabaseClient`.
2. A future Service Layer constructs one client per unit of work and passes it into all repositories involved.
3. True atomic multi-table writes will be implemented as a Postgres RPC / SQL function; repositories stay single-statement so they compose into that RPC without nested transactions.

Until RPC exists, services should order writes carefully and rely on unique constraints (`vimeo_customer_id`, `vott_event_id`, payment provider refs) for idempotency.

## Compatibility

[`vott-events.repository.ts`](../src/repositories/vott-events.repository.ts) re-exports `insertEvent`, `listEvents`, and `getEventById` for Phase 1 webhook ingest. New code should use `VottEventRepository` directly.

## File map

```text
src/repositories/
  base.repository.ts
  customer.repository.ts
  product.repository.ts
  subscription.repository.ts
  subscription-event.repository.ts
  payment.repository.ts
  vott-event.repository.ts
  vott-events.repository.ts   # shim

src/types/
  database.ts
  repository.ts
  errors.ts
  vimeo.ts
```
