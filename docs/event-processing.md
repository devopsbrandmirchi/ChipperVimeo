# Event Processing Engine

Phase 4 — transforms immutable `vott_events` rows into normalized business state.

## Architecture

```text
Vimeo Webhook
      ↓
Insert raw event (vott_events)     ← durable first
      ↓
WebhookProcessingService.process() ← synchronous, same request
      ↓
EventRouter
      ↓
Topic Handler
      ↓
Repositories
      ↓
customers / products / subscriptions / subscription_events / payments
```

Processing runs **inline** after a successful insert. There is no queue, worker, retry engine, DLQ, scheduler, replay, or batch job in this phase.

`WebhookProcessingService.process(event: VottEvent)` is the only entry point. A future background worker can call the same method on stored rows without changing handlers or repositories.

## Event routing

| Topic | Handler |
|-------|---------|
| `customer.created` | `CustomerCreatedHandler` |
| `customer.updated` | `CustomerUpdatedHandler` |
| `customer.product.created` | `CustomerProductCreatedHandler` |
| `customer.product.updated` | `CustomerProductUpdatedHandler` |
| `customer.product.renewed` | `CustomerProductRenewedHandler` |
| `customer.product.cancelled` | `CustomerProductCancelledHandler` |
| `customer.product.expired` | `CustomerProductExpiredHandler` |
| `customer.product.resumed` | `CustomerProductResumedHandler` |
| `customer.product.paused` | `CustomerProductPausedHandler` |
| `customer.product.charge_failed` | `CustomerProductChargeFailedHandler` |
| `customer.product.free_trial_created` | `CustomerProductFreeTrialCreatedHandler` |
| `customer.product.free_trial_converted` | `CustomerProductFreeTrialConvertedHandler` |
| anything else / null | `UnknownEventHandler` |

Routing lives in [`src/processors/event-router.ts`](../src/processors/event-router.ts). The API route must not contain topic switches.

## Handler responsibilities

Each handler owns **one** topic:

1. Validate / extract payload fields (null-safe)
2. Upsert customer (and product when present)
3. Update or create the open subscription
4. Append a `subscription_events` row for product lifecycle topics
5. Create a payment row when the topic implies payment success/failure

Handlers never run SQL. They use repositories via `HandlerContext`.

Customer-only topics upsert the customer and do **not** write `subscription_events` (that table requires `subscription_id`).

Unknown topics log a warning and skip normalization without throwing.

## Idempotency strategy

Vimeo may deliver the same webhook more than once (or retries may create multiple `vott_events` rows with different ids). Within a single `vott_events.id`:

1. **Pre-check** `subscription_events` by `vott_event_id` → return `already_processed`
2. **Customers** upsert on `vimeo_customer_id`
3. **Products** upsert on `vimeo_product_id`
4. **Subscriptions** update `findCurrent(customer, product)` or insert one open row (partial unique index)
5. **Lifecycle events** unique on `vott_event_id` (UniqueViolation treated as success)
6. **Payments** `payment_provider = vimeo` + `transaction_reference = vimeo:{vott_event_id}`

## Error handling

| Error | Meaning |
|-------|---------|
| `ValidationError` | Missing required fields (e.g. customer id) |
| `ProcessingError` | Generic processing failure |
| `UnknownTopicError` | Available but unused by default (unknown → skip) |
| `RepositoryError` | Mapped DB/PostgREST failures from the repository layer |

`process()` catches all errors and returns `{ status: "failed", error }` so the webhook route can still respond **200** after a successful insert (avoids Vimeo retries duplicating raw events).

## HTTP contract

1. Invalid JSON → **400**
2. Insert failure → **500** (Vimeo may retry)
3. Insert success → **200** with `{ ok, id, topic, processing }` even if `processing.status === "failed"`

## Logging

Use [`src/processors/logger/logger.ts`](../src/processors/logger/logger.ts) only. Structured JSON fields include topic, customer/product ids, handler name, duration, and success/failure.

## Adding a new webhook topic

1. Create `src/processors/handlers/<topic>.handler.ts` implementing `EventHandler`
2. Register it in `EventRouter`’s default handler list
3. Reuse `extractPayload` / `processProductLifecycle` helpers when applicable
4. Document the topic in this file

## File map

```text
src/processors/
  event-router.ts
  webhook-processing.service.ts
  types/
  logger/
  helpers/
  handlers/
docs/event-processing.md
```
