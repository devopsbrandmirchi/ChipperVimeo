/**
 * Row / Insert / Update shapes for Phase 2 normalized tables.
 * Timestamps are ISO strings as returned by Supabase/PostgREST.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------

export type Customer = {
  id: string;
  vimeo_customer_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  platform: string | null;
  plan: string | null;
  subscription_status: string | null;
  marketing_opt_in: boolean | null;
  promotion_code: string | null;
  most_recent_promotion_code: string | null;
  coupon_code: string | null;
  registered_to_site: boolean | null;
  subscribed_to_site: boolean | null;
  external_user_id: string | null;
  customer_created_at: string | null;
  customer_updated_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  active_subscription_id: string | null;
  raw_customer: Json | null;
  created_at: string;
  updated_at: string;
};

export type CustomerInsert = {
  vimeo_customer_id: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  platform?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  marketing_opt_in?: boolean | null;
  promotion_code?: string | null;
  most_recent_promotion_code?: string | null;
  coupon_code?: string | null;
  registered_to_site?: boolean | null;
  subscribed_to_site?: boolean | null;
  external_user_id?: string | null;
  customer_created_at?: string | null;
  customer_updated_at?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  active_subscription_id?: string | null;
  raw_customer?: Json | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CustomerUpdate = Partial<
  Omit<CustomerInsert, "vimeo_customer_id">
> & {
  vimeo_customer_id?: number;
};

export type CustomerSubscriptionPatch = {
  subscription_status?: string | null;
  active_subscription_id?: string | null;
  plan?: string | null;
  platform?: string | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  promotion_code?: string | null;
  most_recent_promotion_code?: string | null;
  coupon_code?: string | null;
  subscribed_to_site?: boolean | null;
};

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

export type Product = {
  id: string;
  vimeo_product_id: number;
  sku: string | null;
  name: string | null;
  description: string | null;
  currency: string | null;
  monthly_price_cents: number | null;
  yearly_price_cents: number | null;
  monthly_price_formatted: string | null;
  yearly_price_formatted: string | null;
  monthly_only: boolean | null;
  annual_only: boolean | null;
  free_trial_enabled: boolean | null;
  free_trial_days: number | null;
  movies_count: number | null;
  series_count: number | null;
  categories_count: number | null;
  active: boolean | null;
  product_created_at: string | null;
  product_updated_at: string | null;
  raw_product: Json | null;
  created_at: string;
  updated_at: string;
};

export type ProductInsert = {
  vimeo_product_id: number;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
  currency?: string | null;
  monthly_price_cents?: number | null;
  yearly_price_cents?: number | null;
  monthly_price_formatted?: string | null;
  yearly_price_formatted?: string | null;
  monthly_only?: boolean | null;
  annual_only?: boolean | null;
  free_trial_enabled?: boolean | null;
  free_trial_days?: number | null;
  movies_count?: number | null;
  series_count?: number | null;
  categories_count?: number | null;
  active?: boolean | null;
  product_created_at?: string | null;
  product_updated_at?: string | null;
  raw_product?: Json | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProductUpdate = Partial<Omit<ProductInsert, "vimeo_product_id">> & {
  vimeo_product_id?: number;
};

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export type Subscription = {
  id: string;
  customer_id: string;
  product_id: string;
  status: string | null;
  billing_frequency: string | null;
  currency: string | null;
  price_cents: number | null;
  started_at: string | null;
  renewal_date: string | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  pause_end_date: string | null;
  free_trial: boolean | null;
  free_trial_start: string | null;
  free_trial_end: string | null;
  promotion_code: string | null;
  subscription_created_at: string | null;
  subscription_updated_at: string | null;
  raw_subscription: Json | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionInsert = {
  customer_id: string;
  product_id: string;
  status?: string | null;
  billing_frequency?: string | null;
  currency?: string | null;
  price_cents?: number | null;
  started_at?: string | null;
  renewal_date?: string | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  pause_end_date?: string | null;
  free_trial?: boolean | null;
  free_trial_start?: string | null;
  free_trial_end?: string | null;
  promotion_code?: string | null;
  subscription_created_at?: string | null;
  subscription_updated_at?: string | null;
  raw_subscription?: Json | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type SubscriptionUpdate = Partial<SubscriptionInsert>;

// ---------------------------------------------------------------------------
// subscription_events
// ---------------------------------------------------------------------------

export type SubscriptionEvent = {
  id: string;
  customer_id: string;
  subscription_id: string;
  vott_event_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  event_created_at: string | null;
  payload: Json | null;
  created_at: string;
};

export type SubscriptionEventInsert = {
  customer_id: string;
  subscription_id: string;
  vott_event_id: string;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  event_created_at?: string | null;
  payload?: Json | null;
  id?: string;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------

export type Payment = {
  id: string;
  customer_id: string;
  subscription_id: string | null;
  product_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  status: string | null;
  payment_date: string | null;
  payment_provider: string | null;
  transaction_reference: string | null;
  failure_reason: string | null;
  promotion_code: string | null;
  raw_payment: Json | null;
  created_at: string;
  updated_at: string;
};

export type PaymentInsert = {
  customer_id: string;
  subscription_id?: string | null;
  product_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  payment_date?: string | null;
  payment_provider?: string | null;
  transaction_reference?: string | null;
  failure_reason?: string | null;
  promotion_code?: string | null;
  raw_payment?: Json | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PaymentUpdate = Partial<PaymentInsert>;
