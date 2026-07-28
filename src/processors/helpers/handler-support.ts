import type { HandlerContext } from "@/processors/types/event-handler.interface";
import type { ExtractedPayload } from "@/processors/helpers/payload";
import { ServiceValidationError } from "@/services/shared/errors";
import type { SubscriptionLifecycleInput } from "@/services/interfaces/subscription-service.interface";
import type { Customer, Product } from "@/types/database";
import type { VottEvent } from "@/types/vimeo";

/**
 * Upsert customer + product.
 * Loss/cancel webhooks often omit embedded products — fall back to:
 * 1) denormalized vott_events.product_id (via extractPayload)
 * 2) customer's most recent subscription product
 */
export async function upsertCustomerAndProduct(
  ctx: HandlerContext,
  extracted: ExtractedPayload,
  event: VottEvent,
): Promise<{ customer: Customer; product: Product }> {
  const customer = await ctx.customers.upsertFromVimeoCustomer(
    extracted.customer,
    extracted.vimeoCustomerId,
    event.event_created_at,
  );

  if (extracted.vimeoProductId !== null && extracted.product) {
    const product = await ctx.products.upsertFromVimeoProduct(
      extracted.product,
      extracted.vimeoProductId,
    );
    return { customer, product };
  }

  // Fallback: resolve product from an existing subscription for this customer
  const subs = await ctx.subscriptions.list(
    { customerId: customer.id },
    { page: 1, pageSize: 20, sort: "started_at", direction: "desc" },
  );
  const withProduct = subs.items.find((s) => Boolean(s.product_id));
  if (withProduct?.product_id) {
    const product = await ctx.products.getById(withProduct.product_id);
    ctx.logger.warn("Resolved product from existing subscription", {
      vottEventId: event.id,
      topic: event.topic,
      productId: product.id,
      subscriptionId: withProduct.id,
    });
    return { customer, product };
  }

  throw new ServiceValidationError(
    "Product lifecycle event requires an embedded product id (and no existing subscription product to fall back to)",
  );
}

export function toLifecycleInput(
  event: VottEvent,
  extracted: ExtractedPayload,
  customer: Customer,
  product: Product,
): SubscriptionLifecycleInput {
  return {
    customer,
    product,
    vimeoCustomer: extracted.customer,
    eventCreatedAt: event.event_created_at,
    vottEventId: event.id,
    vimeoCustomerId: extracted.vimeoCustomerId,
    vimeoProductId: extracted.vimeoProductId ?? product.vimeo_product_id,
  };
}
