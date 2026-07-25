import type { Logger } from "@/processors/logger/logger";
import { BaseService } from "@/services/shared/base.service";
import type {
  AnalyticsOverview,
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
 * No heavy report engines yet.
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

  async getOverview(): Promise<AnalyticsOverview> {
    return this.timed("getOverview", async () => {
      const [
        activeSubscribers,
        cancelledSubscriptions,
        trialSubscriptions,
        revenue,
        countries,
        platforms,
      ] = await Promise.all([
        this.getActiveSubscriberCount(),
        this.getCancelledCount(),
        this.getTrialCount(),
        this.getRevenueSummary(),
        this.getCountrySummary(),
        this.getPlatformSummary(),
      ]);
      return {
        activeSubscribers,
        cancelledSubscriptions,
        trialSubscriptions,
        revenue,
        countries,
        platforms,
      };
    });
  }

  async getCustomerStats() {
    return this.timed("getCustomerStats", async () => {
      const [activeSubscribers, countries, platforms] = await Promise.all([
        this.getActiveSubscriberCount(),
        this.getCountrySummary(),
        this.getPlatformSummary(),
      ]);
      return { activeSubscribers, countries, platforms };
    });
  }

  async getSubscriptionStats() {
    return this.timed("getSubscriptionStats", async () => {
      const [cancelled, trial] = await Promise.all([
        this.getCancelledCount(),
        this.getTrialCount(),
      ]);
      return { cancelled, trial };
    });
  }
}
