import type { HandlerContext } from "@/processors/types/event-handler.interface";
import type { ExtractedPayload } from "@/processors/helpers/payload";
import { ServiceValidationError } from "@/services/shared/errors";
import type { SubscriptionLifecycleInput } from "@/services/interfaces/subscription-service.interface";
import type { Customer, Product } from "@/types/database";
import type { VottEvent } from "@/types/vimeo";

/** Upsert customer + product; throws if product id missing. */
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

  if (extracted.vimeoProductId === null || !extracted.product) {
    throw new ServiceValidationError(
      "Product lifecycle event requires an embedded product id",
    );
  }

  const product = await ctx.products.upsertFromVimeoProduct(
    extracted.product,
    extracted.vimeoProductId,
  );

  return { customer, product };
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
    vimeoProductId: extracted.vimeoProductId,
  };
}
