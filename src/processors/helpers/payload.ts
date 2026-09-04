import { ValidationError } from "@/processors/types/processing-errors";
import type { Json } from "@/types/database";
import type {
  VimeoCustomer,
  VimeoProduct,
  VimeoWebhookPayload,
  VottEvent,
} from "@/types/vimeo";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export type ExtractedPayload = {
  customer: VimeoCustomer;
  vimeoCustomerId: number;
  product: VimeoProduct | null;
  vimeoProductId: number | null;
};

export function getWebhookPayload(event: VottEvent): VimeoWebhookPayload {
  return (asRecord(event.payload) ?? {}) as VimeoWebhookPayload;
}

export function getEmbeddedCustomer(
  payload: VimeoWebhookPayload,
): VimeoCustomer | null {
  const embedded = asRecord(payload._embedded);
  const customer = asRecord(embedded?.customer);
  return customer as VimeoCustomer | null;
}

export function getFirstProduct(
  customer: VimeoCustomer | null,
): VimeoProduct | null {
  const products = customer?._embedded?.products;
  if (!Array.isArray(products) || products.length === 0) return null;
  return products[0] ?? null;
}

/** Also look for product on payload root / alternate embeds (loss webhooks vary). */
export function findProductAnywhere(
  payload: VimeoWebhookPayload,
  customer: VimeoCustomer | null,
): VimeoProduct | null {
  const fromCustomer = getFirstProduct(customer);
  if (fromCustomer) return fromCustomer;

  const embedded = asRecord(payload._embedded);
  if (embedded) {
    const direct = asRecord(embedded.product);
    if (direct && (direct.id != null || direct.name != null)) {
      return direct as VimeoProduct;
    }
    const products = embedded.products;
    if (Array.isArray(products) && products.length > 0) {
      return products[0] as VimeoProduct;
    }
  }

  const rootProduct = asRecord((payload as Record<string, unknown>).product);
  if (rootProduct && (rootProduct.id != null || rootProduct.name != null)) {
    return rootProduct as VimeoProduct;
  }
  return null;
}

export function requireVimeoCustomerId(
  customer: VimeoCustomer | null,
): number {
  const id = customer?.id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && id !== "") {
    const n = Number(id);
    if (Number.isFinite(n)) return n;
  }
  throw new ValidationError("Missing or invalid Vimeo customer id");
}

export function optionalVimeoProductId(
  product: VimeoProduct | null,
): number | null {
  if (!product) return null;
  const id = product.id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && id !== "") {
    const n = Number(id);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Extract customer (+ first product). Throws ValidationError if customer id missing.
 * Falls back to denormalized vott_events columns when embedded payload is thin.
 */
export function extractPayload(event: VottEvent): ExtractedPayload {
  const payload = getWebhookPayload(event);
  let customer = getEmbeddedCustomer(payload);

  if (!customer && event.customer_id != null) {
    customer = {
      id: event.customer_id,
      email: event.customer_email,
      name: event.customer_name,
      platform: event.platform,
      subscription_status: event.subscription_status,
    };
  }

  const vimeoCustomerId = requireVimeoCustomerId(customer);
  let product = findProductAnywhere(payload, customer);
  let vimeoProductId = optionalVimeoProductId(product);

  if ((vimeoProductId === null || !product) && event.product_id != null) {
    vimeoProductId = event.product_id;
    product = {
      id: event.product_id,
      name: event.product_name,
    };
  }

  return {
    customer: customer as VimeoCustomer,
    vimeoCustomerId,
    product,
    vimeoProductId,
  };
}

export function asJson(value: unknown): Json | null {
  if (value === undefined) return null;
  return value as Json;
}

/**
 * Normalize Vimeo OTT money fields to integer cents.
 * `subscription_price` is already in cents (e.g. 599 = $5.99) — do not * 100.
 * Only multiply when the value looks like dollars with a fractional part (e.g. 5.99).
 */
export function priceToCents(price: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (!Number.isInteger(price)) return Math.round(price * 100);
  return Math.round(price);
}

function moneyCents(money: { cents?: number } | null | undefined): number | null {
  if (typeof money?.cents !== "number" || !Number.isFinite(money.cents)) {
    return null;
  }
  return Math.round(money.cents);
}

function isYearlyFrequency(frequency: string | null | undefined): boolean {
  const f = (frequency ?? "").toLowerCase();
  return (
    f.includes("year") ||
    f.includes("annual") ||
    f === "yr" ||
    f === "y"
  );
}

/**
 * Pick cents from an embedded Vimeo product price object.
 * Subscription products use monthly/yearly; TVOD uses purchase/rental.
 */
export function vimeoProductPriceCents(
  product: VimeoProduct | null | undefined,
  frequency?: string | null,
): number | null {
  const price = product?.price;
  if (!price) return null;

  const monthly = moneyCents(price.monthly);
  const yearly = moneyCents(price.yearly);
  const purchase = moneyCents(price.purchase);
  const rental = moneyCents(price.rental);

  if (isYearlyFrequency(frequency)) {
    return yearly ?? monthly ?? purchase ?? rental;
  }
  return monthly ?? yearly ?? purchase ?? rental;
}

/**
 * Payment/subscription amount: customer.subscription_price first, then
 * embedded product catalog price for the billing frequency.
 */
export function resolveVimeoAmountCents(opts: {
  subscriptionPrice?: number | null;
  frequency?: string | null;
  product?: VimeoProduct | null;
  fallbackCents?: number | null;
}): number | null {
  return (
    priceToCents(opts.subscriptionPrice) ??
    opts.fallbackCents ??
    vimeoProductPriceCents(opts.product, opts.frequency)
  );
}

export function vimeoProductCurrency(
  product: VimeoProduct | null | undefined,
  frequency?: string | null,
): string | null {
  const price = product?.price;
  if (!price) return null;
  const pick = isYearlyFrequency(frequency)
    ? price.yearly ?? price.monthly ?? price.purchase ?? price.rental
    : price.monthly ?? price.yearly ?? price.purchase ?? price.rental;
  return stringOrNull(pick?.currency);
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/**
 * Detect free-trial entitlement on a Vimeo customer payload.
 * Used so customer.product.created routes to trial path (not paid Gain).
 */
export function isFreeTrialCustomer(customer: VimeoCustomer): boolean {
  const status = stringOrNull(customer.subscription_status)?.toLowerCase() ?? "";
  if (
    status.includes("trial") ||
    status === "free_trial" ||
    status === "freetrial"
  ) {
    return true;
  }
  const flag = (customer as Record<string, unknown>).free_trial;
  if (flag === true || flag === "true" || flag === 1) return true;
  return false;
}

