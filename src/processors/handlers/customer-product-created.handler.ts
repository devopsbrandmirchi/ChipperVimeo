import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { processProductLifecycle } from "@/processors/helpers/entity-upserts";
import { ValidationError } from "@/processors/types/processing-errors";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductCreatedHandler implements EventHandler {
  readonly topic = "customer.product.created";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    if (extracted.vimeoProductId === null) {
      throw new ValidationError("customer.product.created requires a product id");
    }
    await processProductLifecycle(
      ctx,
      extracted,
      event.event_created_at,
      event.id,
      "created",
      { status: extracted.customer.subscription_status ?? "active" },
    );
  }
}
