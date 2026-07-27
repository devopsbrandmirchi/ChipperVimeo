import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload, isFreeTrialCustomer } from "@/processors/helpers/payload";
import {
  toLifecycleInput,
  upsertCustomerAndProduct,
} from "@/processors/helpers/handler-support";
import type { VottEvent } from "@/types/vimeo";

/**
 * Paid create → `created` (Subscription Gain).
 * Trial create → `trial_started` (Trial Gain only) — never double-count as paid Gain.
 */
export class CustomerProductCreatedHandler implements EventHandler {
  readonly topic = "customer.product.created";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    const { customer, product } = await upsertCustomerAndProduct(
      ctx,
      extracted,
      event,
    );
    const input = toLifecycleInput(event, extracted, customer, product);
    if (isFreeTrialCustomer(extracted.customer)) {
      await ctx.subscriptions.startTrial(input);
      return;
    }
    await ctx.subscriptions.create(input);
  }
}
