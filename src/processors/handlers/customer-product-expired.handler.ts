import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { processProductLifecycle } from "@/processors/helpers/entity-upserts";
import { ValidationError } from "@/processors/types/processing-errors";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductExpiredHandler implements EventHandler {
  readonly topic = "customer.product.expired";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    if (extracted.vimeoProductId === null) {
      throw new ValidationError("customer.product.expired requires a product id");
    }
    const at = event.event_created_at ?? new Date().toISOString();
    await processProductLifecycle(
      ctx,
      extracted,
      event.event_created_at,
      event.id,
      "expired",
      {
        status: extracted.customer.subscription_status ?? "expired",
        expiredAt: at,
      },
    );
  }
}
