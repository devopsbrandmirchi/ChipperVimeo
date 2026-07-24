import type {
  EventHandler,
  HandlerContext,
} from "@/processors/types/event-handler.interface";
import { extractPayload } from "@/processors/helpers/payload";
import { upsertCustomerFromPayload } from "@/processors/helpers/entity-upserts";
import type { VottEvent } from "@/types/vimeo";

export class CustomerUpdatedHandler implements EventHandler {
  readonly topic = "customer.updated";

  async handle(event: VottEvent, ctx: HandlerContext): Promise<void> {
    const extracted = extractPayload(event);
    await upsertCustomerFromPayload(ctx, extracted, event.event_created_at);
  }
}
