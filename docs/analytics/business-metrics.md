# Business Metrics (Gain / Loss)

Authoritative mapping from business KPIs to normalized `subscription_events.event_type` values.

| Business Metric | Normalized Event(s) | Description |
| --------------- | ------------------- | ----------- |
| Subscription Gain | `created` (paid only), `trial_converted` | Customer became a paying subscriber |
| Trial Gain | `trial_started` | Customer started a free trial |
| Trial Conversion | `trial_converted` | Trial converted to paid |
| Subscription Loss | `set_cancellation`, `cancelled`, `expired`, `disabled` | Subscription lost, with platform-specific rules |
| Trial Loss | `trial_expired` | Trial ended without conversion |
| Combined Gain | Subscription Gain + Trial Gain | Paid starts + new trials (**event count** of `created` + `trial_started` + `trial_converted`; matches Vimeo “Gained · Subscriptions & trials”) |
| Combined Loss | Subscription Loss + Trial Loss | Lost paid (platform rules) + expired trials |
| Renewal | `renewed` | Successful recurring renewal |
| Recovery | `recovered` | Subscription recovered after a failed payment |
| Charge Failure | `charge_failed` | Payment attempt failed |
| Pause | `paused` | Subscription paused |
| Resume | `resumed` | Subscription resumed |

## Rules

### Subscription Gain

- Count `created` **only** when the create path is an immediately active **paid** subscription (not a free trial).
- Count `trial_converted` as Subscription Gain.
- Never double-count a trial journey: trial starts use `trial_started` (Trial Gain only); paid Gain is recorded at conversion.

### Trial Gain

- Count `trial_started` only (`free_trial_created`, or `created` routed to trial path).

### Trial Conversion

- Count `trial_converted` only.

### Subscription Loss

- **Web** (`normalize_report_platform` = Web):
  - `set_cancellation`
  - `expired`
  - `charge_failed` **only when** event `subscription_status` = `expired`
- **Non-Web** (iOS, Android, TV, OTHER, …): `cancelled`, `expired`, `disabled`
- Platform prefers `vott_events.platform` (event-time), then event payload, then `customers.platform`

### Trial Loss

- Count `trial_expired` only (`free_trial_expired`).

### Dates

- Always `subscription_events.event_created_at` (UTC calendar day).
- Never `subscription_events.created_at` or `vott_events`.

### Counting (Vimeo alignment)

- Gain/loss KPIs are **event counts** (`count(*)` of matching `subscription_events` rows), not `count(distinct subscription_id)`.
- Vimeo “Gained” for Subscriptions & trials ≈ webhooks:
  `customer.product.created` + `free_trial_created` + `free_trial_converted`.
- Local equivalent (SoT):

```sql
select count(*) as combined_gain
from public.subscription_events
where (event_created_at at time zone 'utc')::date = '2026-07-24'
  and event_type in ('created', 'trial_started', 'trial_converted');
```

- Prefer the query above for validation. A `vott_events` topic count is a useful **ingest coverage** check only — reporting must not read `vott_events`. If `vott` ≫ `subscription_events` for that day, some webhooks were never normalized (processor/handler gap or failed processing).

Related: [`event-mapping.md`](event-mapping.md), [`../analytics-business-specification.md`](../analytics-business-specification.md).
