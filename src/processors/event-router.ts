import type { EventHandler } from "@/processors/types/event-handler.interface";
import { CustomerCreatedHandler } from "@/processors/handlers/customer-created.handler";
import { CustomerUpdatedHandler } from "@/processors/handlers/customer-updated.handler";
import { CustomerProductCreatedHandler } from "@/processors/handlers/customer-product-created.handler";
import { CustomerProductUpdatedHandler } from "@/processors/handlers/customer-product-updated.handler";
import { CustomerProductRenewedHandler } from "@/processors/handlers/customer-product-renewed.handler";
import { CustomerProductCancelledHandler } from "@/processors/handlers/customer-product-cancelled.handler";
import { CustomerProductExpiredHandler } from "@/processors/handlers/customer-product-expired.handler";
import { CustomerProductResumedHandler } from "@/processors/handlers/customer-product-resumed.handler";
import { CustomerProductPausedHandler } from "@/processors/handlers/customer-product-paused.handler";
import { CustomerProductChargeFailedHandler } from "@/processors/handlers/customer-product-charge-failed.handler";
import { CustomerProductFreeTrialCreatedHandler } from "@/processors/handlers/customer-product-free-trial-created.handler";
import { CustomerProductFreeTrialConvertedHandler } from "@/processors/handlers/customer-product-free-trial-converted.handler";
import { UnknownEventHandler } from "@/processors/handlers/unknown-event.handler";

/**
 * Maps Vimeo webhook topics to handlers.
 * Route handlers must not contain topic switch logic — use this router.
 */
export class EventRouter {
  private readonly handlers: Map<string, EventHandler>;
  private readonly fallback: EventHandler;

  constructor(handlers?: EventHandler[], fallback?: EventHandler) {
    const list =
      handlers ??
      ([
        new CustomerCreatedHandler(),
        new CustomerUpdatedHandler(),
        new CustomerProductCreatedHandler(),
        new CustomerProductUpdatedHandler(),
        new CustomerProductRenewedHandler(),
        new CustomerProductCancelledHandler(),
        new CustomerProductExpiredHandler(),
        new CustomerProductResumedHandler(),
        new CustomerProductPausedHandler(),
        new CustomerProductChargeFailedHandler(),
        new CustomerProductFreeTrialCreatedHandler(),
        new CustomerProductFreeTrialConvertedHandler(),
      ] as EventHandler[]);

    this.handlers = new Map(list.map((h) => [h.topic, h]));
    this.fallback = fallback ?? new UnknownEventHandler();
  }

  resolve(topic: string | null | undefined): EventHandler {
    if (!topic) return this.fallback;
    return this.handlers.get(topic) ?? this.fallback;
  }
}
