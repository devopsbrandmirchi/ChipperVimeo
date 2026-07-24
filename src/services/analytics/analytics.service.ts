import type { Logger } from "@/processors/logger/logger";
import { BaseService } from "@/services/shared/base.service";
import type {
  DimensionSummary,
  IAnalyticsService,
  RevenueSummary,
} from "@/services/interfaces/analytics-service.interface";
import type {
  ICustomerRepository,
  IPaymentRepository,
  ISubscriptionRepository,
} from "@/services/interfaces/repositories";

/**
 * Placeholder analytics helpers for future APIs.
 * No heavy report engines in Phase 5.
 */
export class AnalyticsService extends BaseService implements IAnalyticsService {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly subscriptions: ISubscriptionRepository,
    private readonly payments: IPaymentRepository,
    logger: Logger,
  ) {
    super("AnalyticsService", logger);
  }

  async getActiveSubscriberCount(): Promise<number> {
    return this.timed("getActiveSubscriberCount", async () => {
      return this.customers.count({ subscription_status: "active" });
    });
  }

  async getCancelledCount(): Promise<number> {
    return this.timed("getCancelledCount", async () => {
      return this.subscriptions.count({ status: "cancelled" });
    });
  }

  async getRevenueSummary(): Promise<RevenueSummary> {
    return this.timed("getRevenueSummary", async () => {
      // Placeholder — full revenue rollups land in a later phase.
      void this.payments;
      return {
        revenueCents: 0,
        currency: null,
        note: "Placeholder — implement in analytics phase",
      };
    });
  }

  async getTrialCount(): Promise<number> {
    return this.timed("getTrialCount", async () => {
      return this.subscriptions.count({ status: "free_trial" });
    });
  }

  async getCountrySummary(): Promise<DimensionSummary> {
    return this.timed("getCountrySummary", async () => {
      const total = await this.customers.count();
      return {
        dimension: "country",
        total,
        note: "Placeholder — breakdown by country in a later phase",
      };
    });
  }

  async getPlatformSummary(): Promise<DimensionSummary> {
    return this.timed("getPlatformSummary", async () => {
      const total = await this.customers.count();
      return {
        dimension: "platform",
        total,
        note: "Placeholder — breakdown by platform in a later phase",
      };
    });
  }
}
