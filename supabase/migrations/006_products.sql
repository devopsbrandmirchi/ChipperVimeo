-- Phase 2: products — one row per Vimeo product / plan SKU.

create table public.products (
  id uuid primary key default gen_random_uuid(),

  -- Vimeo natural key (maps to product.id in _embedded.customer._embedded.products[])
  vimeo_product_id bigint not null,

  sku text,
  name text,
  description text,

  currency text,
  monthly_price_cents integer,
  yearly_price_cents integer,
  monthly_price_formatted text,
  yearly_price_formatted text,

  monthly_only boolean,
  annual_only boolean,

  free_trial_enabled boolean,
  free_trial_days integer,

  movies_count integer,
  series_count integer,
  categories_count integer,

  active boolean,

  product_created_at timestamptz,
  product_updated_at timestamptz,

  raw_product jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_vimeo_product_id_key unique (vimeo_product_id),

  constraint products_monthly_price_cents_nonneg
    check (monthly_price_cents is null or monthly_price_cents >= 0),

  constraint products_yearly_price_cents_nonneg
    check (yearly_price_cents is null or yearly_price_cents >= 0),

  constraint products_free_trial_days_nonneg
    check (free_trial_days is null or free_trial_days >= 0)
);

comment on table public.products is
  'Normalized Vimeo products/plans. One row per vimeo_product_id. Money stored as integer cents.';

comment on column public.products.vimeo_product_id is
  'Vimeo OTT product id. Unique for idempotent upserts from webhooks.';

comment on column public.products.raw_product is
  'Last-seen product object from webhook _embedded.products[] for audit/debug.';

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

alter table public.products enable row level security;

notify pgrst, 'reload schema';
