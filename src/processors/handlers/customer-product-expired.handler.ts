import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import {
  toLifecycleInput,
  upsertCustomerAndProduct,
} from "@/processors/helpers/handler-support";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductExpiredHandler implements EventHandler {
  readonly topic = "customer.product.expired";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    const { customer, product } = await upsertCustomerAndProduct(
      ctx,
      extracted,
      event,
    );
    await ctx.subscriptions.expire(
      toLifecycleInput(event, extracted, customer, product),
    );
  }
}
