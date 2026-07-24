import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import type { VottEvent } from "@/types/vimeo";

/**
 * Fallback for unmapped topics. Logs a warning and completes without DB writes.
 * Never throws — processing must not crash on unknown topics.
 */
export class UnknownEventHandler implements EventHandler {
  readonly topic = "*";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    ctx.logger.warn("Unknown webhook topic — skipped normalization", {
      topic: event.topic,
      vottEventId: event.id,
      customerId: event.customer_id,
      productId: event.product_id,
      handler: "UnknownEventHandler",
    });
  }
}
