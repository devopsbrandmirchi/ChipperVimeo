import type { SupabaseClient } from "@supabase/supabase-js";

import { EventRouter } from "@/processors/event-router";
import { defaultLogger, type Logger } from "@/processors/logger/logger";
import type { HandlerContext } from "@/processors/types/event-handler.interface";
import type { ProcessingResult } from "@/processors/types/processing-result";
import { CustomerRepository } from "@/repositories/customer.repository";
import { PaymentRepository } from "@/repositories/payment.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { SubscriptionEventRepository } from "@/repositories/subscription-event.repository";
import { SubscriptionRepository } from "@/repositories/subscription.repository";
import { VottEventRepository } from "@/repositories/vott-event.repository";
import { CustomerService } from "@/services/customer/customer.service";
import { PaymentService } from "@/services/payment/payment.service";
import { ProductService } from "@/services/product/product.service";
import { SubscriptionService } from "@/services/subscription/subscription.service";
import { TimelineService } from "@/services/timeline/timeline.service";
import type { VottEvent } from "@/types/vimeo";

/**
 * Synchronous event processing entry point.
 *
 * Call after a row is stored in vott_events. A future background worker can
 * invoke the same process(event) without changing handlers or repositories.
 * Analytics is not on this hot path — use the API service container.
 */
export class WebhookProcessingService {
  private readonly router: EventRouter;
  private readonly logger: Logger;
  private readonly ctx: HandlerContext;
  private readonly timeline: TimelineService;
  private readonly vottEvents: VottEventRepository;

  constructor(options?: {
    client?: SupabaseClient;
    router?: EventRouter;
    logger?: Logger;
  }) {
    const client = options?.client;
    this.router = options?.router ?? new EventRouter();
    this.logger = options?.logger ?? defaultLogger;
    this.vottEvents = new VottEventRepository(client);

    const customerRepo = new CustomerRepository(client);
    const productRepo = new ProductRepository(client);
    const subscriptionRepo = new SubscriptionRepository(client);
    const subscriptionEventRepo = new SubscriptionEventRepository(client);
    const paymentRepo = new PaymentRepository(client);

    const customers = new CustomerService(customerRepo, this.logger);
    const products = new ProductService(productRepo, this.logger);
    const timeline = new TimelineService(subscriptionEventRepo, this.logger);
    const subscriptions = new SubscriptionService(
      subscriptionRepo,
      customers,
      timeline,
      this.logger,
    );
    const payments = new PaymentService(paymentRepo, customers, this.logger);

    this.timeline = timeline;

    this.ctx = {
      customers,
      products,
      subscriptions,
      payments,
      timeline,
      logger: this.logger,
    };
  }

  async process(event: VottEvent): Promise<ProcessingResult> {
    const started = Date.now();
    const topic = event.topic;
    const handler = this.router.resolve(topic);
    const handlerName = handler.constructor.name;

    const log = this.logger.child({
      vottEventId: event.id,
      topic,
      handler: handlerName,
      customerId: event.customer_id,
      productId: event.product_id,
    });

    try {
      const existing = await this.timeline.findByVottEventId(event.id);
      if (existing) {
        const durationMs = Date.now() - started;
        log.info("Event already processed", {
          durationMs,
          success: true,
          status: "already_processed",
        });
        return {
          status: "already_processed",
          vottEventId: event.id,
          topic,
          handler: handlerName,
          durationMs,
        };
      }

      await handler.handle(event, this.ctx);

      const durationMs = Date.now() - started;
      const status =
        handler.topic === "*" ? ("skipped" as const) : ("processed" as const);

      log.info("Event processing complete", {
        durationMs,
        success: true,
        status,
      });

      return {
        status,
        vottEventId: event.id,
        topic,
        handler: handlerName,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message =
        error instanceof Error ? error.message : "Unknown processing error";

      log.error("Event processing failed", {
        durationMs,
        success: false,
        status: "failed",
        error: message,
      });

      return {
        status: "failed",
        vottEventId: event.id,
        topic,
        handler: handlerName,
        durationMs,
        error: message,
      };
    }
  }

  /**
   * Replay gain-topic vott_events that have no subscription_events row.
   * Idempotent via vott_event_id uniqueness / already_processed check.
   */
  async reprocessUnprocessedGainEvents(options: {
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<{
    startDate: string;
    endDate: string;
    attempted: number;
    processed: number;
    alreadyProcessed: number;
    failed: number;
    skipped: number;
    failures: Array<{ vottEventId: string; topic: string | null; error: string }>;
  }> {
    const events = await this.vottEvents.findUnprocessedGainEvents(options);
    const failures: Array<{
      vottEventId: string;
      topic: string | null;
      error: string;
    }> = [];
    let processed = 0;
    let alreadyProcessed = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of events) {
      const result = await this.process(event);
      if (result.status === "processed") processed += 1;
      else if (result.status === "already_processed") alreadyProcessed += 1;
      else if (result.status === "skipped") skipped += 1;
      else {
        failed += 1;
        failures.push({
          vottEventId: result.vottEventId,
          topic: result.topic,
          error: result.error ?? "failed",
        });
      }
    }

    return {
      startDate: options.startDate,
      endDate: options.endDate,
      attempted: events.length,
      processed,
      alreadyProcessed,
      failed,
      skipped,
      failures: failures.slice(0, 50),
    };
  }
}

/** Shared instance for the webhook route (sync inline processing). */
export const webhookProcessingService = new WebhookProcessingService();
