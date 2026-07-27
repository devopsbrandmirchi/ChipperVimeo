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
  let product = getFirstProduct(customer);
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

/** Convert dollars (number) to integer cents when Vimeo sends float price. */
export function priceToCents(price: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return Math.round(price * 100);
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

