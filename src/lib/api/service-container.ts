/**
 * Composition root for API routes.
 * Framework-agnostic wiring — no next/* imports (core-ready).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { defaultLogger, type Logger } from "@/processors/logger/logger";
import { AnalyticsRepository } from "@/modules/analytics/repository/analytics.repository";
import { DailyMetricsRepository } from "@/modules/analytics/repository/daily-metrics.repository";
import {
  AnalyticsService,
  type IAnalyticsService,
} from "@/modules/analytics/service/analytics.service";
import {
  MetricsBuilderService,
  type IMetricsBuilderService,
} from "@/modules/analytics/metrics-builder/metrics-builder.service";
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
import { WebhookEventService } from "@/services/webhook-event/webhook-event.service";
import type { ICustomerService } from "@/services/interfaces/customer-service.interface";
import type { IPaymentService } from "@/services/interfaces/payment-service.interface";
import type { IProductService } from "@/services/interfaces/product-service.interface";
import type { ISubscriptionService } from "@/services/interfaces/subscription-service.interface";
import type { ITimelineService } from "@/services/interfaces/timeline-service.interface";
import type { IWebhookEventService } from "@/services/interfaces/webhook-event-service.interface";

export type ApiServices = {
  customers: ICustomerService;
  products: IProductService;
  subscriptions: ISubscriptionService;
  payments: IPaymentService;
  timeline: ITimelineService;
  webhookEvents: IWebhookEventService;
  analytics: IAnalyticsService;
  metricsBuilder: IMetricsBuilderService;
  logger: Logger;
};

export function createApiServices(logger: Logger = defaultLogger): ApiServices {
  const client = createServiceClient();

  const customerRepo = new CustomerRepository(client);
  const productRepo = new ProductRepository(client);
  const subscriptionRepo = new SubscriptionRepository(client);
  const subscriptionEventRepo = new SubscriptionEventRepository(client);
  const paymentRepo = new PaymentRepository(client);
  const vottEventRepo = new VottEventRepository(client);
  const analyticsRepo = new AnalyticsRepository(client);
  const dailyRepo = new DailyMetricsRepository(client);

  const customers = new CustomerService(customerRepo, logger);
  const products = new ProductService(productRepo, logger);
  const timeline = new TimelineService(subscriptionEventRepo, logger);
  const subscriptions = new SubscriptionService(
    subscriptionRepo,
    customers,
    timeline,
    logger,
  );
  const payments = new PaymentService(paymentRepo, customers, logger);
  const webhookEvents = new WebhookEventService(vottEventRepo, logger);
  const analytics = new AnalyticsService(analyticsRepo, dailyRepo, logger);
  const metricsBuilder = new MetricsBuilderService(dailyRepo, logger);

  return {
    customers,
    products,
    subscriptions,
    payments,
    timeline,
    webhookEvents,
    analytics,
    metricsBuilder,
    logger,
  };
}
