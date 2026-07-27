# Analytics Event Mapping

**Single source of truth** for Vimeo topic → `subscription_events.event_type` → business use.

Reporting **never** queries `public.vott_events`. Dates use `subscription_events.event_created_at` (UTC day).

## Mapping table

| Vimeo Topic | `subscription_events.event_type` | Business Meaning | Used In |
|-------------|----------------------------------|------------------|---------|
| `customer.created` | — (no timeline row) | Customer identity upsert | New Customers (via `customers`) |
| `customer.updated` | — | Profile / dimension attributes | Attribution only |
| `customer.product.created` | `created` | Paid subscription started (not trial) | **Subscription Gain** |
| `customer.product.created` (trial payload) | `trial_started` | Routed to trial path — not paid Gain | **Trial Gain** |
| `customer.product.updated` | `updated` | Snapshot refresh | Informational |
| `customer.product.renewed` | `renewed` | Successful recurring renewal | Renewal metrics |
| `customer.product.cancelled` | `cancelled` | Cancelled (store / general) | **Subscription Loss** (store platforms) |
| `customer.product.expired` | `expired` | Expired | **Subscription Loss** (store) |
| `customer.product.disabled` | `disabled` | Disabled by store/platform | **Subscription Loss** (store) |
| `customer.product.paused` | `paused` | Paused | Pause metrics |
| `customer.product.resumed` | `resumed` | Resumed | Resume metrics |
| `customer.product.charge_failed` | `charge_failed` | Payment failed | Charge failure metrics |
| `customer.product.free_trial_created` | `trial_started` | Free trial began | **Trial Gain** |
| `customer.product.free_trial_converted` | `trial_converted` | Trial → paid | **Subscription Gain**, **Trial Conversion** |
| `customer.product.free_trial_expired` | `trial_expired` | Trial ended without convert | **Trial Loss** |
| `customer.product.set_cancellation` | `set_cancellation` | Scheduled / Web cancel | **Subscription Loss** (Web/direct) |
| Unknown topics | — | Skipped | — |

## Platform rules for Subscription Loss

| Platform family | Events counted as Subscription Loss |
|-----------------|-------------------------------------|
| Web / direct billing | `set_cancellation` |
| Store (iOS, Android, Apple TV, Fire TV, Google TV, Roku, …) | `cancelled`, `expired`, `disabled` |

See also [`business-metrics.md`](business-metrics.md).
