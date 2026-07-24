/** Vimeo OTT / VHX webhook topic names */
export type VimeoWebhookTopic =
  | "customer.created"
  | "customer.deleted"
  | "customer.updated"
  | "customer.product.created"
  | "customer.product.deleted"
  | "customer.product.cancelled"
  | "customer.product.paused"
  | "customer.product.renewed"
  | "customer.product.charge_failed"
  | "customer.product.expired"
  | "customer.product.disabled"
  | "customer.product.free_trial_created"
  | "customer.product.free_trial_converted"
  | "customer.product.free_trial_expired"
  | "customer.product.updated"
  | "customer.product.set_paused"
  | "customer.product.undo_set_paused"
  | "customer.product.resumed"
  | "customer.product.set_cancellation"
  | "customer.product.undo_set_cancellation"
  | "customer.product.set_change"
  | "customer.product.undo_set_change"
  | "customer.product.changed"
  | "customer.tvod.created"
  | "customer.tvod.accessed"
  | "customer.tvod.expired"
  | (string & {});

export type VimeoMoney = {
  cents?: number;
  currency?: string;
  formatted?: string;
};

export type VimeoProduct = {
  id?: number;
  name?: string | null;
  description?: string | null;
  is_active?: string | boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  types?: string[];
  price?: {
    purchase?: VimeoMoney;
    rental?: VimeoMoney;
  };
  links?: Record<string, unknown>;
  [key: string]: unknown;
};

export type VimeoCustomer = {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  thumbnail?: string | null;
  plan?: string | null;
  platform?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  marketing_opt_in?: boolean | null;
  registered_to_site?: boolean | null;
  subscribed_to_site?: boolean | null;
  subscription_status?: string | null;
  subscription_frequency?: string | null;
  subscription_price?: number | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  pause_end_date?: string | null;
  coupon_code?: string | null;
  promotion_code?: string | null;
  campaign?: string | null;
  referrer?: string | null;
  location?: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
  } | null;
  subscription_event?: Record<string, unknown> | null;
  links?: Record<string, unknown>;
  _embedded?: {
    products?: VimeoProduct[];
  };
  [key: string]: unknown;
};

/** Raw POST body from Vimeo OTT webhooks (and admin Send-test). */
export type VimeoWebhookPayload = {
  topic?: VimeoWebhookTopic | null;
  created_at?: string | null;
  _embedded?: {
    customer?: VimeoCustomer | null;
  } | null;
  [key: string]: unknown;
};

/**
 * Normalized row shape for `vott_events`.
 * Phase 2 list/filter APIs and admin tables should use this type.
 */
export type VottEventInsert = {
  topic: string | null;
  event_created_at: string | null;
  customer_id: number | null;
  customer_email: string | null;
  customer_name: string | null;
  product_id: number | null;
  product_name: string | null;
  subscription_status: string | null;
  platform: string | null;
  payload: VimeoWebhookPayload;
};

export type VottEvent = VottEventInsert & {
  id: string;
  received_at: string;
  /** Calendar date (UTC) derived from received_at — best for day filters */
  received_date: string;
};

/** Phase 2 filter params for listing webhook events */
export type VottEventFilters = {
  topic?: string;
  customerId?: number;
  customerEmail?: string;
  /** Inclusive start date `YYYY-MM-DD` (uses received_date) */
  from?: string;
  /** Inclusive end date `YYYY-MM-DD` (uses received_date) */
  to?: string;
  limit?: number;
  offset?: number;
};
