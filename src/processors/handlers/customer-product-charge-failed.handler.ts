import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { processProductLifecycle } from "@/processors/helpers/entity-upserts";
import { ValidationError } from "@/processors/types/processing-errors";
import type { VottEvent } from "@/types/vimeo";

export class CustomerProductChargeFailedHandler implements EventHandler {
  readonly topic = "customer.product.charge_failed";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    if (extracted.vimeoProductId === null) {
      throw new ValidationError(
        "customer.product.charge_failed requires a product id",
      );
    }
    await processProductLifecycle(
      ctx,
      extracted,
      event.event_created_at,
      event.id,
      "charge_failed",
      {
        status: extracted.customer.subscription_status ?? "charge_failed",
      },
      {
        status: "failed",
        failureReason: "Vimeo charge_failed webhook",
      },
    );
  }
}
