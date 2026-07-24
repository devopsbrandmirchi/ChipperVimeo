import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { processProductLifecycle } from "@/processors/helpers/entity-upserts";
import { ValidationError } from "@/processors/types/processing-errors";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductFreeTrialConvertedHandler implements EventHandler {
  readonly topic = "customer.product.free_trial_converted";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    if (extracted.vimeoProductId === null) {
      throw new ValidationError(
        "customer.product.free_trial_converted requires a product id",
      );
    }
    const end = event.event_created_at ?? new Date().toISOString();
    const hasPrice =
      typeof extracted.customer.subscription_price === "number" &&
      Number.isFinite(extracted.customer.subscription_price);

    await processProductLifecycle(
      ctx,
      extracted,
      event.event_created_at,
      event.id,
      "trial_converted",
      {
        status: extracted.customer.subscription_status ?? "active",
        freeTrial: false,
        freeTrialEnd: end,
      },
      hasPrice ? { status: "succeeded" } : undefined,
    );
  }
}
