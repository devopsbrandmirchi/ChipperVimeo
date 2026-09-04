import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import {
  extractPayload,
  resolveVimeoAmountCents,
  stringOrNull,
  vimeoProductCurrency,
} from "@/processors/helpers/payload";
import {
  toLifecycleInput,
  upsertCustomerAndProduct,
} from "@/processors/helpers/handler-support";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductChargeFailedHandler implements EventHandler {
  readonly topic = "customer.product.charge_failed";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    const { customer, product } = await upsertCustomerAndProduct(
      ctx,
      extracted,
      event,
    );
    const input = toLifecycleInput(event, extracted, customer, product);

    const { subscription, previousStatus } = await ctx.subscriptions.syncState(
      input,
      { status: extracted.customer.subscription_status ?? "charge_failed" },
    );

    const frequency =
      extracted.customer.subscription_frequency ??
      subscription.billing_frequency;
    const amountCents = resolveVimeoAmountCents({
      subscriptionPrice: extracted.customer.subscription_price,
      frequency,
      product: extracted.product,
      fallbackCents: subscription.price_cents,
    });

    await ctx.payments.recordFailed({
      customerId: customer.id,
      subscriptionId: subscription.id,
      productId: product.id,
      vottEventId: event.id,
      amountCents,
      currency:
        product.currency ??
        vimeoProductCurrency(extracted.product, frequency) ??
        subscription.currency,
      paymentDate:
        stringOrNull(extracted.customer.last_payment_date) ??
        event.event_created_at,
      promotionCode: stringOrNull(extracted.customer.promotion_code),
      failureReason: "Vimeo charge_failed webhook",
    });

    await ctx.timeline.recordChargeFailed({
      customerId: customer.id,
      subscriptionId: subscription.id,
      vottEventId: event.id,
      previousStatus,
      newStatus: subscription.status,
      eventCreatedAt: event.event_created_at,
      payload: {
        vimeo_customer_id: extracted.vimeoCustomerId,
        vimeo_product_id: extracted.vimeoProductId,
        subscription_status: extracted.customer.subscription_status ?? null,
        platform: event.platform,
      },
    });
  }
}
