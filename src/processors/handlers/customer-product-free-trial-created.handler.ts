import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { processProductLifecycle } from "@/processors/helpers/entity-upserts";
import { ValidationError } from "@/processors/types/processing-errors";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductFreeTrialCreatedHandler implements EventHandler {
  readonly topic = "customer.product.free_trial_created";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    if (extracted.vimeoProductId === null) {
      throw new ValidationError(
        "customer.product.free_trial_created requires a product id",
      );
    }
    const start = event.event_created_at ?? new Date().toISOString();
    await processProductLifecycle(
      ctx,
      extracted,
      event.event_created_at,
      event.id,
      "trial_started",
      {
        status: extracted.customer.subscription_status ?? "free_trial",
        freeTrial: true,
        freeTrialStart: start,
      },
    );
  }
}
