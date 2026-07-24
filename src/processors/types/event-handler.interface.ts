import type { Logger } from "@/processors/logger/logger";
import type { ICustomerService } from "@/services/interfaces/customer-service.interface";
import type { IPaymentService } from "@/services/interfaces/payment-service.interface";
import type { IProductService } from "@/services/interfaces/product-service.interface";
import type { ISubscriptionService } from "@/services/interfaces/subscription-service.interface";
import type { ITimelineService } from "@/services/interfaces/timeline-service.interface";
import type { VottEvent } from "@/types/vimeo";

export type HandlerContext = {
  customers: ICustomerService;
  products: IProductService;
  subscriptions: ISubscriptionService;
  payments: IPaymentService;
  timeline: ITimelineService;
  logger: Logger;
};

export interface EventHandler {
  /** Exact Vimeo topic, or "*" for the unknown fallback. */
  readonly topic: string;
  handle(event: VottEvent, ctx: HandlerContext): Promise<void>;
}
