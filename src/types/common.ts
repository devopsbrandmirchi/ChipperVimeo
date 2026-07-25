/**
 * Shared filter / search / statistics DTOs used by services and controllers.
 * Framework-agnostic — safe to relocate to a future `core/` package.
 */

export type CustomerListFilters = {
  status?: string;
  subscriptionStatus?: string;
  country?: string;
  platform?: string;
  plan?: string;
  /** Product filter is approximate (no customer↔product join in frozen repos). */
  productId?: string;
  signupFrom?: string;
  signupTo?: string;
  search?: string;
};

export type SubscriptionListFilters = {
  status?: string;
  billingFrequency?: string;
  productId?: string;
  customerId?: string;
  trial?: boolean;
  renewalFrom?: string;
  renewalTo?: string;
};

export type ProductListFilters = {
  active?: boolean;
  sku?: string;
  search?: string;
  name?: string;
};

export type PaymentListFilters = {
  status?: string;
  customerId?: string;
  subscriptionId?: string;
  currency?: string;
  from?: string;
  to?: string;
};

export type WebhookEventListFilters = {
  topic?: string;
  customerId?: number;
  email?: string;
  productId?: number;
  from?: string;
  to?: string;
};

export type ResourceStatistics = {
  total: number;
  byStatus?: Record<string, number>;
  note?: string;
};
