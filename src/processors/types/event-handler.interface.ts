import type { CustomerRepository } from "@/repositories/customer.repository";
import type { PaymentRepository } from "@/repositories/payment.repository";
import type { ProductRepository } from "@/repositories/product.repository";
import type { SubscriptionEventRepository } from "@/repositories/subscription-event.repository";
import type { SubscriptionRepository } from "@/repositories/subscription.repository";
import type { Logger } from "@/processors/logger/logger";
import type { VottEvent } from "@/types/vimeo";

export type HandlerContext = {
  customerRepo: CustomerRepository;
  productRepo: ProductRepository;
  subscriptionRepo: SubscriptionRepository;
  subscriptionEventRepo: SubscriptionEventRepository;
  paymentRepo: PaymentRepository;
  logger: Logger;
};

export interface EventHandler {
  /** Exact Vimeo topic, or "*" for the unknown fallback. */
  readonly topic: string;
  handle(event: VottEvent, ctx: HandlerContext): Promise<void>;
}
