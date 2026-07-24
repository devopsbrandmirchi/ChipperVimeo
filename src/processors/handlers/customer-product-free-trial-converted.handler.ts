import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload, priceToCents, stringOrNull } from "@/processors/helpers/payload";
import {
  toLifecycleInput,
  upsertCustomerAndProduct,
} from "@/processors/helpers/handler-support";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductFreeTrialConvertedHandler implements EventHandler {
  readonly topic = "customer.product.free_trial_converted";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    const { customer, product } = await upsertCustomerAndProduct(
      ctx,
      extracted,
      event,
    );
    const input = toLifecycleInput(event, extracted, customer, product);
    const end = event.event_created_at ?? new Date().toISOString();

    const hasPrice =
      typeof extracted.customer.subscription_price === "number" &&
      Number.isFinite(extracted.customer.subscription_price);

    const { subscription, previousStatus } = await ctx.subscriptions.syncState(
      input,
      {
        status: extracted.customer.subscription_status ?? "active",
        freeTrial: false,
        freeTrialEnd: end,
      },
    );

    if (hasPrice) {
      await ctx.payments.recordRenewal({
        customerId: customer.id,
        subscriptionId: subscription.id,
        productId: product.id,
        vottEventId: event.id,
        amountCents: priceToCents(extracted.customer.subscription_price),
        currency: product.currency,
        paymentDate:
          stringOrNull(extracted.customer.last_payment_date) ??
          event.event_created_at,
        promotionCode: stringOrNull(extracted.customer.promotion_code),
        nextPaymentDate: stringOrNull(extracted.customer.next_payment_date),
      });
    }

    await ctx.timeline.recordTrialConverted({
      customerId: customer.id,
      subscriptionId: subscription.id,
      vottEventId: event.id,
      previousStatus,
      newStatus: subscription.status,
      eventCreatedAt: event.event_created_at,
      payload: {
        vimeo_customer_id: extracted.vimeoCustomerId,
        vimeo_product_id: extracted.vimeoProductId,
      },
    });
  }
}
