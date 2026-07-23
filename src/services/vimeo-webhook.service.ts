import type {
  VimeoCustomer,
  VimeoProduct,
  VimeoWebhookPayload,
  VottEventInsert,
} from "@/types/vimeo";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstProduct(customer: VimeoCustomer | null | undefined): VimeoProduct | null {
  const products = customer?._embedded?.products;
  if (!Array.isArray(products) || products.length === 0) return null;
  return products[0] ?? null;
}

/**
 * Accept unknown JSON (including Vimeo Send-test null-filled payloads)
 * and normalize into a `vott_events` insert row.
 */
export function normalizeVimeoWebhookPayload(
  raw: unknown,
): VottEventInsert {
  const payload = (asRecord(raw) ?? {}) as VimeoWebhookPayload;
  const embedded = asRecord(payload._embedded);
  const customer = (asRecord(embedded?.customer) ??
    null) as VimeoCustomer | null;
  const product = firstProduct(customer);

  const topic =
    typeof payload.topic === "string" && payload.topic.length > 0
      ? payload.topic
      : null;

  const eventCreatedAt =
    typeof payload.created_at === "string" ? payload.created_at : null;

  const customerId =
    typeof customer?.id === "number"
      ? customer.id
      : typeof customer?.id === "string" && customer.id !== ""
        ? Number(customer.id)
        : null;

  const productId =
    typeof product?.id === "number"
      ? product.id
      : typeof product?.id === "string" && product.id !== ""
        ? Number(product.id)
        : null;

  return {
    topic,
    event_created_at: eventCreatedAt,
    customer_id: Number.isFinite(customerId) ? customerId : null,
    customer_email:
      typeof customer?.email === "string" ? customer.email : null,
    customer_name: typeof customer?.name === "string" ? customer.name : null,
    product_id: Number.isFinite(productId) ? productId : null,
    product_name: typeof product?.name === "string" ? product.name : null,
    subscription_status:
      typeof customer?.subscription_status === "string"
        ? customer.subscription_status
        : null,
    platform: typeof customer?.platform === "string" ? customer.platform : null,
    payload,
  };
}

export function parseVimeoWebhookBody(bodyText: string): unknown {
  if (!bodyText || bodyText.trim() === "") {
    return {};
  }
  return JSON.parse(bodyText) as unknown;
}
