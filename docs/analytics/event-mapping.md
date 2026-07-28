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
| `customer.product.cancelled` | `cancelled` | Cancelled | **Subscription Loss** (non-Web) |
| `customer.product.expired` | `expired` | Expired | **Subscription Loss** (Web + non-Web) |
| `customer.product.disabled` | `disabled` | Disabled by store/platform | **Subscription Loss** (non-Web) |
| `customer.product.paused` | `paused` | Paused | Pause metrics |
| `customer.product.resumed` | `resumed` | Resumed | Resume metrics |
| `customer.product.charge_failed` | `charge_failed` | Payment failed | Charge failure; **Subscription Loss** on Web when `subscription_status=expired` |
| `customer.product.free_trial_created` | `trial_started` | Free trial began | **Trial Gain** |
| `customer.product.free_trial_converted` | `trial_converted` | Trial → paid | **Subscription Gain**, **Trial Conversion** |
| `customer.product.free_trial_expired` | `trial_expired` | Trial ended without convert | **Trial Loss** |
| `customer.product.set_cancellation` | `set_cancellation` | Scheduled / Web cancel | **Subscription Loss** (Web) |
| Unknown topics | — | Skipped | — |

## Platform rules for Subscription Loss

| Platform family | Events counted as Subscription Loss |
|-----------------|-------------------------------------|
| Web | `set_cancellation`, `expired`, `charge_failed` (only if `subscription_status = expired`) |
| Non-Web (iOS, Android, TV, OTHER, …) | `cancelled`, `expired`, `disabled` |

Trial Loss (any platform): `free_trial_expired` → `trial_expired`.

See also [`business-metrics.md`](business-metrics.md).
