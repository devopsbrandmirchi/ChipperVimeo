# Domain Service Layer

Phase 5 — business rules live in services; handlers stay thin; repositories only persist.

## Responsibilities

| Layer | Knows | Must not |
|-------|--------|----------|
| **Event handlers** | What happened (topic + payload) | Business rules, SQL |
| **Domain services** | What to do (rules, orchestration) | HTTP, React, raw SQL |
| **Repositories** | How to save/load | Business rules, other services |

```text
Webhook → WebhookProcessingService → EventRouter → Handler
    → Domain Services → Repositories → Database
```

## Service boundaries

| Service | Owns |
|---------|------|
| `CustomerService` | Upsert/profile/location/marketing/promo/subscription snapshot/payment dates/last seen |
| `ProductService` | Upsert/pricing/trial flags/active/metadata |
| `SubscriptionService` | Create/renew/pause/resume/cancel/expire/trial + open-sub uniqueness |
| `PaymentService` | Renewal/failed/recovered payments; customer payment date updates |
| `TimelineService` | `subscription_events` lifecycle markers (idempotent on `vott_event_id`) |
| `AnalyticsService` | Placeholder counters for future APIs (no heavy reports yet) |

Ingest normalizer [`vimeo-webhook.service.ts`](../src/services/vimeo-webhook.service.ts) remains separate (Phase 1 payload shaping only).

## Dependency flow

- Handlers → services only (via `HandlerContext`)
- Services → repository ports (interfaces) + peer services when needed
- `SubscriptionService` → `CustomerService` + `TimelineService`
- `PaymentService` → `CustomerService`
- Repositories never call services
- Avoid cycles: Timeline does not call Subscription/Payment

All services are constructed with explicit constructor injection (no service-layer singletons). `WebhookProcessingService` wires repos → services once per instance.

## Business rules (examples)

- **One open subscription** per customer+product (`findCurrent` then update, else create)
- **No duplicate customers/products** — upsert on Vimeo IDs
- **Timeline idempotency** — unique `vott_event_id`; duplicates treated as already recorded
- **Payment idempotency** — `transaction_reference = vimeo:{vottEventId}`
- **Payment before timeline** for renew/charge_failed/trial_converted — handlers call `syncState` → `PaymentService` → `TimelineService` so retries can still record payments

## Error handling

Service errors in [`src/services/shared/errors.ts`](../src/services/shared/errors.ts):

- `ValidationError` / `ServiceValidationError`
- `BusinessRuleViolationError`
- `EntityNotFoundError`
- `DuplicateEntityError`

`BaseService.mapRepositoryError` converts `RepositoryError` into these types. Callers never see raw PostgREST errors.

## Handler pattern

```ts
const extracted = extractPayload(event);
const { customer, product } = await upsertCustomerAndProduct(ctx, extracted, event);
await ctx.subscriptions.cancel(toLifecycleInput(event, extracted, customer, product));
```

Payload extract helpers stay in processors; business logic does not.

## Adding a new service

1. Define interface under `src/services/interfaces/`
2. Implement class with constructor DI + `BaseService.timed`
3. Wire in `WebhookProcessingService` if handlers need it
4. Extend `HandlerContext` only if handlers call it
5. Document methods here

## Testing

Inject mock repository ports and peer services into constructors. Do not import `createServiceClient` inside services.

## File map

```text
src/services/
  shared/base.service.ts
  shared/errors.ts
  interfaces/
  customer/customer.service.ts
  product/product.service.ts
  subscription/subscription.service.ts
  payment/payment.service.ts
  timeline/timeline.service.ts
  analytics/analytics.service.ts
  vimeo-webhook.service.ts   # ingest only
```
