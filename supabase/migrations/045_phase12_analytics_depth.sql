-- Phase 12 — Analytics Depth: engine conformance slice
-- 1) Daily subscription gain from events (not started_at)
-- 2) Renewals = renewed event + succeeded payment same UTC day
-- 3) Active = open paid EOD (exclude trial + paused)
-- 4) Churn = cancels(D) / active paid EOD(D−1)
-- 5) Live Renewals today matches (4)
-- 6) Cohort trial conversion RPC

create or replace function analytics.active_paid_subscribers_eod(p_date date)
returns bigint
language sql
stable
security definer
set search_path = analytics, public
as $$
  select count(distinct s.customer_id)::bigint
  from public.subscriptions s
  where s.started_at is not null
    and (s.started_at at time zone 'utc')::date <= p_date
    and (s.cancelled_at is null or (s.cancelled_at at time zone 'utc')::date > p_date)
    and (s.expired_at is null or (s.expired_at at time zone 'utc')::date > p_date)
    and coalesce(s.free_trial, false) is not true
    and (s.status is null or lower(s.status) not like '%pause%');
$$;

comment on function analytics.active_paid_subscribers_eod(date) is
  '§4.1 Active Subscribers EOD: distinct customers with ≥1 open paid (non-paused) subscription.';

grant execute on function analytics.active_paid_subscribers_eod(date) to service_role, authenticated;

-- Live today KPIs: renewals = renew event + succeeded payment (never renewal_date)
create or replace function analytics.get_dashboard_today_kpis()
returns table (
  new_customers_today bigint,
  renewals_today bigint,
  cancelled_today bigint,
  revenue_today_cents bigint,
  as_of timestamptz
)
language sql
stable
security definer
set search_path = analytics, public
as $$
  with today as (
    select (timezone('utc', now()))::date as d
  )
  select
    (
      select count(*)::bigint
      from public.customers c, today t
      where c.first_seen_at is not null
        and (c.first_seen_at at time zone 'utc')::date = t.d
    ) as new_customers_today,
    (
      select count(distinct e.subscription_id)::bigint
      from public.subscription_events e
      join today t on true
      where e.event_type = 'renewed'
        and e.subscription_id is not null
        and (e.event_created_at at time zone 'utc')::date = t.d
        and exists (
          select 1
          from public.payments p
          where p.subscription_id = e.subscription_id
            and p.payment_date is not null
            and (p.payment_date at time zone 'utc')::date = t.d
            and (
              p.status is null
              or lower(p.status) in ('succeeded', 'paid', 'success', 'completed')
            )
        )
    ) as renewals_today,
    (
      select count(*)::bigint
      from public.subscriptions s, today t
      where s.cancelled_at is not null
        and (s.cancelled_at at time zone 'utc')::date = t.d
    ) as cancelled_today,
    (
      select coalesce(sum(p.amount_cents), 0)::bigint
      from public.payments p, today t
      where (p.status is null or lower(p.status) in ('succeeded', 'paid', 'success', 'completed'))
        and p.payment_date is not null
        and (p.payment_date at time zone 'utc')::date = t.d
    ) as revenue_today_cents,
    timezone('utc', now()) as as_of;
$$;

comment on function analytics.get_dashboard_today_kpis() is
  'Live UTC-day KPIs. Renewals = renewed event + succeeded payment same day (Phase 12).';

grant execute on function analytics.get_dashboard_today_kpis() to service_role, authenticated;

-- Rebuild daily snapshots with Phase 12 subscription definitions
create or replace function analytics.build_daily_snapshots(p_date date)
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
declare
  v_built_at timestamptz := timezone('utc', now());
  v_new_subs bigint;
  v_renewals bigint;
  v_cancellations bigint;
  v_expirations bigint;
  v_paused bigint;
  v_resumed bigint;
  v_active bigint;
  v_prior_active bigint;
  v_net bigint;
  v_churn numeric(8, 2);
  v_trials_started bigint;
  v_trials_converted bigint;
  v_trials_expired bigint;
  v_trial_conv numeric(8, 2);
  v_ok_pay bigint;
  v_fail_pay bigint;
  v_recovered bigint;
  v_recovered_events bigint;
  v_success_rate numeric(8, 2);
  v_revenue bigint;
  v_new_customers bigint;
  v_active_customers bigint;
  v_returning bigint;
begin
  if p_date is null then
    raise exception 'p_date is required';
  end if;

  -- Subscription Gain (events) — not started_at "new subscriptions"
  select count(*)::bigint into v_new_subs
  from public.subscription_events e
  where e.event_type in ('created', 'trial_converted')
    and (e.event_created_at at time zone 'utc')::date = p_date;

  -- Renewals: renew intent + money same UTC day
  select count(distinct e.subscription_id)::bigint into v_renewals
  from public.subscription_events e
  where e.event_type = 'renewed'
    and e.subscription_id is not null
    and (e.event_created_at at time zone 'utc')::date = p_date
    and exists (
      select 1
      from public.payments p
      where p.subscription_id = e.subscription_id
        and p.payment_date is not null
        and (p.payment_date at time zone 'utc')::date = p_date
        and (
          p.status is null
          or lower(p.status) in ('succeeded', 'paid', 'success', 'completed')
        )
    );

  select count(*)::bigint into v_cancellations
  from public.subscriptions s
  where s.cancelled_at is not null
    and (s.cancelled_at at time zone 'utc')::date = p_date;

  select count(*)::bigint into v_expirations
  from public.subscriptions s
  where s.expired_at is not null
    and (s.expired_at at time zone 'utc')::date = p_date;

  select count(*)::bigint into v_paused
  from public.subscription_events e
  where e.event_type = 'paused'
    and (e.event_created_at at time zone 'utc')::date = p_date;

  select count(*)::bigint into v_resumed
  from public.subscription_events e
  where e.event_type = 'resumed'
    and (e.event_created_at at time zone 'utc')::date = p_date;

  -- Active paid EOD (exclude trial + paused)
  v_active := analytics.active_paid_subscribers_eod(p_date);

  -- Prefer prior-day snapshot when present (rebuild oldest→newest); else compute
  select dsm.active_subscriptions
    into v_prior_active
  from analytics.daily_subscription_metrics dsm
  where dsm.date = (p_date - 1);

  if v_prior_active is null then
    v_prior_active := analytics.active_paid_subscribers_eod(p_date - 1);
  end if;

  v_net := v_new_subs - v_cancellations - v_expirations;
  v_churn := case
    when coalesce(v_prior_active, 0) > 0
      then round((v_cancellations::numeric / v_prior_active * 100)::numeric, 2)
    else 0
  end;

  insert into analytics.daily_subscription_metrics as t (
    date, new_subscriptions, renewals, cancellations, expirations,
    paused, resumed, active_subscriptions, net_growth, churn_rate, built_at
  ) values (
    p_date, v_new_subs, v_renewals, v_cancellations, v_expirations,
    v_paused, v_resumed, v_active, v_net, v_churn, v_built_at
  )
  on conflict (date) do update set
    new_subscriptions = excluded.new_subscriptions,
    renewals = excluded.renewals,
    cancellations = excluded.cancellations,
    expirations = excluded.expirations,
    paused = excluded.paused,
    resumed = excluded.resumed,
    active_subscriptions = excluded.active_subscriptions,
    net_growth = excluded.net_growth,
    churn_rate = excluded.churn_rate,
    built_at = excluded.built_at;

  -- ---------- trials (flow counts; same-day conversion is a flow ratio, not cohort) ----------
  select count(*)::bigint into v_trials_started
  from public.subscriptions s
  where s.free_trial_start is not null
    and (s.free_trial_start at time zone 'utc')::date = p_date;

  select count(*)::bigint into v_trials_converted
  from public.subscription_events e
  where e.event_type = 'trial_converted'
    and (e.event_created_at at time zone 'utc')::date = p_date;

  select count(*)::bigint into v_trials_expired
  from public.subscriptions s
  where s.free_trial_end is not null
    and (s.free_trial_end at time zone 'utc')::date = p_date
    and not exists (
      select 1
      from public.subscription_events e
      where e.subscription_id = s.id
        and e.event_type = 'trial_converted'
        and (e.event_created_at at time zone 'utc')::date <= p_date
    );

  v_trial_conv := case
    when v_trials_started > 0
      then round((v_trials_converted::numeric / v_trials_started * 100)::numeric, 2)
    else 0
  end;

  insert into analytics.daily_trial_metrics as t (
    date, trials_started, trials_converted, trials_expired, conversion_rate, built_at
  ) values (
    p_date, v_trials_started, v_trials_converted, v_trials_expired, v_trial_conv, v_built_at
  )
  on conflict (date) do update set
    trials_started = excluded.trials_started,
    trials_converted = excluded.trials_converted,
    trials_expired = excluded.trials_expired,
    conversion_rate = excluded.conversion_rate,
    built_at = excluded.built_at;

  -- ---------- payments ----------
  select
    count(*) filter (
      where p.status is null
         or lower(p.status) in ('succeeded', 'paid', 'success', 'completed')
    )::bigint,
    count(*) filter (
      where p.status is not null
        and lower(p.status) in ('failed', 'failure', 'declined', 'charge_failed')
    )::bigint,
    coalesce(sum(p.amount_cents) filter (
      where p.status is null
         or lower(p.status) in ('succeeded', 'paid', 'success', 'completed')
    ), 0)::bigint
  into v_ok_pay, v_fail_pay, v_revenue
  from public.payments p
  where p.payment_date is not null
    and (p.payment_date at time zone 'utc')::date = p_date;

  with ordered as (
    select
      (p.payment_date at time zone 'utc')::date as pay_day,
      case
        when p.status is null
          or lower(p.status) in ('succeeded', 'paid', 'success', 'completed')
          then 'ok'
        when p.status is not null
          and lower(p.status) in ('failed', 'failure', 'declined', 'charge_failed')
          then 'fail'
        else 'other'
      end as outcome,
      lag(
        case
          when p.status is null
            or lower(p.status) in ('succeeded', 'paid', 'success', 'completed')
            then 'ok'
          when p.status is not null
            and lower(p.status) in ('failed', 'failure', 'declined', 'charge_failed')
            then 'fail'
          else 'other'
        end
      ) over (
        partition by p.subscription_id
        order by p.payment_date nulls last, p.created_at nulls last, p.id
      ) as prev_outcome
    from public.payments p
    where p.subscription_id is not null
      and p.payment_date is not null
  )
  select count(*)::bigint into v_recovered
  from ordered o
  where o.pay_day = p_date
    and o.outcome = 'ok'
    and o.prev_outcome = 'fail';

  select count(*)::bigint into v_recovered_events
  from public.subscription_events e
  where e.event_type = 'recovered'
    and (e.event_created_at at time zone 'utc')::date = p_date;

  if v_recovered_events > v_recovered then
    v_recovered := v_recovered_events;
  end if;

  v_success_rate := case
    when (v_ok_pay + v_fail_pay) > 0
      then round((v_ok_pay::numeric / (v_ok_pay + v_fail_pay) * 100)::numeric, 2)
    else 0
  end;

  insert into analytics.daily_payment_metrics as t (
    date, successful_payments, failed_payments, recovered_payments,
    payment_success_rate, revenue_cents, built_at
  ) values (
    p_date, v_ok_pay, v_fail_pay, v_recovered, v_success_rate, v_revenue, v_built_at
  )
  on conflict (date) do update set
    successful_payments = excluded.successful_payments,
    failed_payments = excluded.failed_payments,
    recovered_payments = excluded.recovered_payments,
    payment_success_rate = excluded.payment_success_rate,
    revenue_cents = excluded.revenue_cents,
    built_at = excluded.built_at;

  -- ---------- customers ----------
  select count(*)::bigint into v_new_customers
  from public.customers c
  where c.first_seen_at is not null
    and (c.first_seen_at at time zone 'utc')::date = p_date;

  select count(distinct s.customer_id)::bigint into v_active_customers
  from public.subscriptions s
  where s.started_at is not null
    and (s.started_at at time zone 'utc')::date <= p_date
    and (s.cancelled_at is null or (s.cancelled_at at time zone 'utc')::date > p_date)
    and (s.expired_at is null or (s.expired_at at time zone 'utc')::date > p_date);

  with activity as (
    select distinct p.customer_id
    from public.payments p
    where p.customer_id is not null
      and p.payment_date is not null
      and (p.payment_date at time zone 'utc')::date = p_date
    union
    select distinct e.customer_id
    from public.subscription_events e
    where e.customer_id is not null
      and (e.event_created_at at time zone 'utc')::date = p_date
  )
  select count(*)::bigint into v_returning
  from activity a
  join public.customers c on c.id = a.customer_id
  where c.first_seen_at is not null
    and (c.first_seen_at at time zone 'utc')::date < p_date;

  insert into analytics.daily_customer_metrics as t (
    date, new_customers, active_customers, returning_customers, built_at
  ) values (
    p_date, v_new_customers, v_active_customers, v_returning, v_built_at
  )
  on conflict (date) do update set
    new_customers = excluded.new_customers,
    active_customers = excluded.active_customers,
    returning_customers = excluded.returning_customers,
    built_at = excluded.built_at;

  -- ---------- product metrics ----------
  delete from analytics.daily_product_metrics where date = p_date;

  insert into analytics.daily_product_metrics (
    date, product_id, product_name, active_subscribers, new_subscribers, revenue, built_at
  )
  select
    p_date,
    p.id,
    p.name,
    coalesce(act.active_subscribers, 0),
    coalesce(ns.new_subscribers, 0),
    coalesce(rev.revenue, 0),
    v_built_at
  from public.products p
  left join (
    select
      s.product_id,
      count(distinct s.customer_id)::bigint as active_subscribers
    from public.subscriptions s
    where s.product_id is not null
      and s.started_at is not null
      and (s.started_at at time zone 'utc')::date <= p_date
      and (s.cancelled_at is null or (s.cancelled_at at time zone 'utc')::date > p_date)
      and (s.expired_at is null or (s.expired_at at time zone 'utc')::date > p_date)
      and coalesce(s.free_trial, false) is not true
      and (s.status is null or lower(s.status) not like '%pause%')
    group by s.product_id
  ) act on act.product_id = p.id
  left join (
    select
      s.product_id,
      count(*)::bigint as new_subscribers
    from public.subscription_events e
    join public.subscriptions s on s.id = e.subscription_id
    where s.product_id is not null
      and e.event_type in ('created', 'trial_converted')
      and (e.event_created_at at time zone 'utc')::date = p_date
    group by s.product_id
  ) ns on ns.product_id = p.id
  left join (
    select
      pay.product_id,
      coalesce(sum(pay.amount_cents), 0)::bigint as revenue
    from public.payments pay
    where pay.product_id is not null
      and pay.payment_date is not null
      and (pay.payment_date at time zone 'utc')::date = p_date
      and (
        pay.status is null
        or lower(pay.status) in ('succeeded', 'paid', 'success', 'completed')
      )
    group by pay.product_id
  ) rev on rev.product_id = p.id
  where coalesce(act.active_subscribers, 0) > 0
     or coalesce(ns.new_subscribers, 0) > 0
     or coalesce(rev.revenue, 0) > 0;

  -- ---------- country metrics ----------
  delete from analytics.daily_country_metrics where date = p_date;

  insert into analytics.daily_country_metrics (
    date, country, active_subscribers, new_subscribers, revenue, built_at
  )
  with countries as (
    select distinct coalesce(nullif(trim(c.country), ''), 'unknown') as country
    from public.customers c
  ),
  active as (
    select
      coalesce(nullif(trim(c.country), ''), 'unknown') as country,
      count(distinct s.customer_id)::bigint as active_subscribers
    from public.subscriptions s
    join public.customers c on c.id = s.customer_id
    where s.started_at is not null
      and (s.started_at at time zone 'utc')::date <= p_date
      and (s.cancelled_at is null or (s.cancelled_at at time zone 'utc')::date > p_date)
      and (s.expired_at is null or (s.expired_at at time zone 'utc')::date > p_date)
      and coalesce(s.free_trial, false) is not true
      and (s.status is null or lower(s.status) not like '%pause%')
    group by 1
  ),
  news as (
    select
      coalesce(nullif(trim(c.country), ''), 'unknown') as country,
      count(*)::bigint as new_subscribers
    from public.subscription_events e
    join public.customers c on c.id = e.customer_id
    where e.event_type in ('created', 'trial_converted')
      and (e.event_created_at at time zone 'utc')::date = p_date
    group by 1
  ),
  rev as (
    select
      coalesce(nullif(trim(c.country), ''), 'unknown') as country,
      coalesce(sum(pay.amount_cents), 0)::bigint as revenue
    from public.payments pay
    join public.customers c on c.id = pay.customer_id
    where pay.payment_date is not null
      and (pay.payment_date at time zone 'utc')::date = p_date
      and (
        pay.status is null
        or lower(pay.status) in ('succeeded', 'paid', 'success', 'completed')
      )
    group by 1
  )
  select
    p_date,
    co.country,
    coalesce(a.active_subscribers, 0),
    coalesce(n.new_subscribers, 0),
    coalesce(r.revenue, 0),
    v_built_at
  from countries co
  left join active a on a.country = co.country
  left join news n on n.country = co.country
  left join rev r on r.country = co.country
  where coalesce(a.active_subscribers, 0) > 0
     or coalesce(n.new_subscribers, 0) > 0
     or coalesce(r.revenue, 0) > 0;

  -- ---------- platform metrics ----------
  delete from analytics.daily_platform_metrics where date = p_date;

  insert into analytics.daily_platform_metrics (
    date, platform, active_subscribers, new_subscribers, revenue, built_at
  )
  with platforms as (
    select distinct coalesce(nullif(trim(c.platform), ''), 'unknown') as platform
    from public.customers c
  ),
  active as (
    select
      coalesce(nullif(trim(c.platform), ''), 'unknown') as platform,
      count(distinct s.customer_id)::bigint as active_subscribers
    from public.subscriptions s
    join public.customers c on c.id = s.customer_id
    where s.started_at is not null
      and (s.started_at at time zone 'utc')::date <= p_date
      and (s.cancelled_at is null or (s.cancelled_at at time zone 'utc')::date > p_date)
      and (s.expired_at is null or (s.expired_at at time zone 'utc')::date > p_date)
      and coalesce(s.free_trial, false) is not true
      and (s.status is null or lower(s.status) not like '%pause%')
    group by 1
  ),
  news as (
    select
      coalesce(nullif(trim(c.platform), ''), 'unknown') as platform,
      count(*)::bigint as new_subscribers
    from public.subscription_events e
    join public.customers c on c.id = e.customer_id
    where e.event_type in ('created', 'trial_converted')
      and (e.event_created_at at time zone 'utc')::date = p_date
    group by 1
  ),
  rev as (
    select
      coalesce(nullif(trim(c.platform), ''), 'unknown') as platform,
      coalesce(sum(pay.amount_cents), 0)::bigint as revenue
    from public.payments pay
    join public.customers c on c.id = pay.customer_id
    where pay.payment_date is not null
      and (pay.payment_date at time zone 'utc')::date = p_date
      and (
        pay.status is null
        or lower(pay.status) in ('succeeded', 'paid', 'success', 'completed')
      )
    group by 1
  )
  select
    p_date,
    pl.platform,
    coalesce(a.active_subscribers, 0),
    coalesce(n.new_subscribers, 0),
    coalesce(r.revenue, 0),
    v_built_at
  from platforms pl
  left join active a on a.platform = pl.platform
  left join news n on n.platform = pl.platform
  left join rev r on r.platform = pl.platform
  where coalesce(a.active_subscribers, 0) > 0
     or coalesce(n.new_subscribers, 0) > 0
     or coalesce(r.revenue, 0) > 0;
end;
$$;

comment on function analytics.build_daily_snapshots(date) is
  'Phase 12: subscription gain from events; renewals=event+payment; churn=cancels/prior active paid EOD.';

grant execute on function analytics.build_daily_snapshots(date) to service_role;

-- Cohort trial conversion: starts in month → converted within trial window
create or replace function analytics.fn_cohort_trial_conversion(
  p_from date,
  p_to date
)
returns table (
  cohort_month date,
  trials_started bigint,
  trials_converted bigint,
  conversion_pct numeric
)
language sql
stable
security definer
set search_path = analytics, public
set statement_timeout = '60s'
as $$
  with bounds as (
    select
      date_trunc('month', p_from::timestamp)::date as from_month,
      date_trunc('month', p_to::timestamp)::date as to_month
  ),
  starts as (
    select
      s.id as subscription_id,
      (date_trunc('month', s.free_trial_start at time zone 'utc'))::date as cohort_month,
      s.free_trial_start,
      coalesce(
        s.free_trial_end,
        s.free_trial_start + interval '30 days'
      ) as window_end
    from public.subscriptions s
    cross join bounds b
    where s.free_trial_start is not null
      and (date_trunc('month', s.free_trial_start at time zone 'utc'))::date
        between b.from_month and b.to_month
  ),
  converted as (
    select distinct st.subscription_id
    from starts st
    join public.subscription_events e on e.subscription_id = st.subscription_id
    where e.event_type = 'trial_converted'
      and e.event_created_at <= st.window_end
  )
  select
    st.cohort_month,
    count(*)::bigint as trials_started,
    count(*) filter (where c.subscription_id is not null)::bigint as trials_converted,
    case
      when count(*) = 0 then 0::numeric
      else round(
        100.0 * count(*) filter (where c.subscription_id is not null) / count(*),
        4
      )
    end as conversion_pct
  from starts st
  left join converted c on c.subscription_id = st.subscription_id
  group by st.cohort_month
  order by 1;
$$;

comment on function analytics.fn_cohort_trial_conversion(date, date) is
  'Cohort trial conversion: free_trial_start month → trial_converted within trial window (or +30d).';

grant execute on function analytics.fn_cohort_trial_conversion(date, date)
  to service_role, authenticated;

notify pgrst, 'reload schema';
