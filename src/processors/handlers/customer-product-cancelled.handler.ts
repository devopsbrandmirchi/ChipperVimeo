import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { processProductLifecycle } from "@/processors/helpers/entity-upserts";
import { ValidationError } from "@/processors/types/processing-errors";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductCancelledHandler implements EventHandler {
  readonly topic = "customer.product.cancelled";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    if (extracted.vimeoProductId === null) {
      throw new ValidationError(
        "customer.product.cancelled requires a product id",
      );
    }
    const at = event.event_created_at ?? new Date().toISOString();
    await processProductLifecycle(
      ctx,
      extracted,
      event.event_created_at,
      event.id,
      "cancelled",
      {
        status: extracted.customer.subscription_status ?? "cancelled",
        cancelledAt: at,
      },
    );
  }
}
