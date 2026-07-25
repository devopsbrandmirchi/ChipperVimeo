import type { Logger } from "@/processors/logger/logger";
import { BaseService } from "@/services/shared/base.service";
import type { AnalyticsFilters } from "@/modules/analytics/dto/filters";
import type {
  AnalyticsOverview,
  ARRResponse,
  ChurnAnalyticsResponse,
  CountryAnalyticsResponse,
  CustomerAnalyticsResponse,
  DashboardResponse,
  LTVResponse,
  MRRResponse,
  PaymentAnalyticsResponse,
  PlatformAnalyticsResponse,
  ProductAnalyticsResponse,
  RevenueResponse,
  SubscriptionAnalyticsResponse,
  TrialAnalyticsResponse,
} from "@/modules/analytics/dto/responses";
import {
  mapArr,
  mapChurn,
  mapCountries,
  mapCustomerAnalytics,
  mapDashboard,
  mapLtv,
  mapMrr,
  mapOverviewFromDashboard,
  mapPayments,
  mapPlatforms,
  mapProducts,
  mapRevenue,
  mapSubscriptions,
  mapTrials,
} from "@/modules/analytics/mappers/analytics.mappers";
import { listMetrics } from "@/modules/analytics/metrics";
import { AnalyticsRepository } from "@/modules/analytics/repository/analytics.repository";

export interface IAnalyticsService {
  getDashboard(): Promise<DashboardResponse>;
  getOverview(): Promise<AnalyticsOverview>;
  getRevenue(filters?: AnalyticsFilters): Promise<RevenueResponse>;
  getCustomerAnalytics(
    filters?: AnalyticsFilters,
  ): Promise<CustomerAnalyticsResponse>;
  getSubscriptionAnalytics(): Promise<SubscriptionAnalyticsResponse>;
  getProductAnalytics(): Promise<ProductAnalyticsResponse>;
  getCountryAnalytics(): Promise<CountryAnalyticsResponse>;
  getPlatformAnalytics(): Promise<PlatformAnalyticsResponse>;
  getPaymentAnalytics(): Promise<PaymentAnalyticsResponse>;
  getTrialAnalytics(): Promise<TrialAnalyticsResponse>;
  getChurnAnalytics(): Promise<ChurnAnalyticsResponse>;
  getMrr(): Promise<MRRResponse>;
  getArr(): Promise<ARRResponse>;
  getLtv(): Promise<LTVResponse>;
  refresh(
    target?:
      | "all"
      | "dashboard"
      | "daily_metrics"
      | "monthly_metrics"
      | "customer_metrics"
      | "subscription_metrics"
      | "product_metrics"
      | "country_metrics"
      | "platform_metrics"
      | "revenue_metrics"
      | "trial_metrics"
      | "payment_metrics"
      | "churn_metrics"
      | "ltv_metrics",
  ): Promise<{ ok: true; target: string; metricsCatalogSize: number }>;

  /** Phase 8 compatibility shims */
  getActiveSubscriberCount(): Promise<number>;
  getCancelledCount(): Promise<number>;
  getTrialCount(): Promise<number>;
  getRevenueSummary(): Promise<{
    revenueCents: number;
    currency: string | null;
    note: string;
  }>;
  getCountrySummary(): Promise<{
    dimension: string;
    total: number;
    note: string;
  }>;
  getPlatformSummary(): Promise<{
    dimension: string;
    total: number;
    note: string;
  }>;
  getCustomerStats(): Promise<{
    activeSubscribers: number;
    countries: { dimension: string; total: number; note: string };
    platforms: { dimension: string; total: number; note: string };
  }>;
  getSubscriptionStats(): Promise<{ cancelled: number; trial: number }>;
}

export class AnalyticsService extends BaseService implements IAnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    logger: Logger,
  ) {
    super("AnalyticsService", logger);
  }

  async getDashboard(): Promise<DashboardResponse> {
    return this.timed("getDashboard", async () => {
      try {
        const row = await this.repo.getDashboard();
        return mapDashboard(row);
      } catch (error) {
        this.mapRepositoryError(error, "getDashboard");
      }
    });
  }

  async getOverview(): Promise<AnalyticsOverview> {
    return this.timed("getOverview", async () => {
      const [dashboard, countries, platforms] = await Promise.all([
        this.getDashboard(),
        this.repo.listCountryMetrics(),
        this.repo.listPlatformMetrics(),
      ]);
      return mapOverviewFromDashboard(
        dashboard,
        countries.length,
        platforms.length,
      );
    });
  }

  async getRevenue(filters: AnalyticsFilters = {}): Promise<RevenueResponse> {
    return this.timed("getRevenue", async () => {
      try {
        const dashboard = await this.getDashboard();
        const groupBy =
          filters.groupBy === "month" ||
          filters.groupBy === "quarter" ||
          filters.groupBy === "year"
            ? "month"
            : "day";
        const series =
          groupBy === "month"
            ? await this.repo.getMonthlyMetrics(filters)
            : await this.repo.getDailyMetrics(filters);
        return mapRevenue(dashboard, series, groupBy);
      } catch (error) {
        this.mapRepositoryError(error, "getRevenue");
      }
    });
  }

  async getCustomerAnalytics(
    filters: AnalyticsFilters = {},
  ): Promise<CustomerAnalyticsResponse> {
    return this.timed("getCustomerAnalytics", async () => {
      try {
        const limit = filters.limit ?? 25;
        const [
          dashboard,
          topLtv,
          inTrial,
          failedPayments,
          recentlyCancelled,
          countries,
          platforms,
        ] = await Promise.all([
          this.getDashboard(),
          this.repo.getTopLtvCustomers(limit),
          this.repo.getCustomersInTrial(limit),
          this.repo.getCustomersFailedPayments(limit),
          this.repo.getRecentlyCancelledCustomers(limit),
          this.repo.listCountryMetrics(),
          this.repo.listPlatformMetrics(),
        ]);
        return mapCustomerAnalytics({
          dashboard,
          topLtv,
          inTrial,
          failedPayments,
          recentlyCancelled,
          countries,
          platforms,
        });
      } catch (error) {
        this.mapRepositoryError(error, "getCustomerAnalytics");
      }
    });
  }

  async getSubscriptionAnalytics(): Promise<SubscriptionAnalyticsResponse> {
    return this.timed("getSubscriptionAnalytics", async () => {
      try {
        return mapSubscriptions(await this.repo.getSubscriptionMetrics());
      } catch (error) {
        this.mapRepositoryError(error, "getSubscriptionAnalytics");
      }
    });
  }

  async getProductAnalytics(): Promise<ProductAnalyticsResponse> {
    return this.timed("getProductAnalytics", async () => {
      try {
        return mapProducts(await this.repo.listProductMetrics());
      } catch (error) {
        this.mapRepositoryError(error, "getProductAnalytics");
      }
    });
  }

  async getCountryAnalytics(): Promise<CountryAnalyticsResponse> {
    return this.timed("getCountryAnalytics", async () => {
      try {
        return mapCountries(await this.repo.listCountryMetrics());
      } catch (error) {
        this.mapRepositoryError(error, "getCountryAnalytics");
      }
    });
  }

  async getPlatformAnalytics(): Promise<PlatformAnalyticsResponse> {
    return this.timed("getPlatformAnalytics", async () => {
      try {
        return mapPlatforms(await this.repo.listPlatformMetrics());
      } catch (error) {
        this.mapRepositoryError(error, "getPlatformAnalytics");
      }
    });
  }

  async getPaymentAnalytics(): Promise<PaymentAnalyticsResponse> {
    return this.timed("getPaymentAnalytics", async () => {
      try {
        return mapPayments(await this.repo.getPaymentMetrics());
      } catch (error) {
        this.mapRepositoryError(error, "getPaymentAnalytics");
      }
    });
  }

  async getTrialAnalytics(): Promise<TrialAnalyticsResponse> {
    return this.timed("getTrialAnalytics", async () => {
      try {
        const [trial, dashboard] = await Promise.all([
          this.repo.getTrialMetrics(),
          this.getDashboard(),
        ]);
        return mapTrials(trial, dashboard.trialConversionPct);
      } catch (error) {
        this.mapRepositoryError(error, "getTrialAnalytics");
      }
    });
  }

  async getChurnAnalytics(): Promise<ChurnAnalyticsResponse> {
    return this.timed("getChurnAnalytics", async () => {
      try {
        const [churn, dashboard] = await Promise.all([
          this.repo.getChurnMetrics(),
          this.getDashboard(),
        ]);
        return mapChurn(churn, dashboard.retentionRatePct);
      } catch (error) {
        this.mapRepositoryError(error, "getChurnAnalytics");
      }
    });
  }

  async getMrr(): Promise<MRRResponse> {
    return this.timed("getMrr", async () => mapMrr(await this.getDashboard()));
  }

  async getArr(): Promise<ARRResponse> {
    return this.timed("getArr", async () => mapArr(await this.getDashboard()));
  }

  async getLtv(): Promise<LTVResponse> {
    return this.timed("getLtv", async () => {
      try {
        return mapLtv(await this.repo.getLtvMetrics());
      } catch (error) {
        this.mapRepositoryError(error, "getLtv");
      }
    });
  }

  async refresh(
    target:
      | "all"
      | "dashboard"
      | "daily_metrics"
      | "monthly_metrics"
      | "customer_metrics"
      | "subscription_metrics"
      | "product_metrics"
      | "country_metrics"
      | "platform_metrics"
      | "revenue_metrics"
      | "trial_metrics"
      | "payment_metrics"
      | "churn_metrics"
      | "ltv_metrics" = "all",
  ) {
    return this.timed("refresh", async () => {
      try {
        await this.repo.refresh(target);
        this.logger.info("Analytics refresh complete", {
          action: "analytics_refresh",
          target,
        });
        return {
          ok: true as const,
          target,
          metricsCatalogSize: listMetrics().length,
        };
      } catch (error) {
        this.mapRepositoryError(error, "refresh");
      }
    });
  }

  async getActiveSubscriberCount(): Promise<number> {
    return (await this.getDashboard()).activeSubscribers;
  }

  async getCancelledCount(): Promise<number> {
    return (await this.getDashboard()).cancelled;
  }

  async getTrialCount(): Promise<number> {
    return (await this.getDashboard()).freeTrials;
  }

  async getRevenueSummary() {
    const d = await this.getDashboard();
    return {
      revenueCents: d.revenueMonthCents,
      currency: null,
      note: "From analytics.mv_dashboard",
    };
  }

  async getCountrySummary() {
    const countries = await this.repo.listCountryMetrics();
    return {
      dimension: "country",
      total: countries.length,
      note: "Breakdown via /api/v1/analytics/countries",
    };
  }

  async getPlatformSummary() {
    const platforms = await this.repo.listPlatformMetrics();
    return {
      dimension: "platform",
      total: platforms.length,
      note: "Breakdown via /api/v1/analytics/platforms",
    };
  }

  async getCustomerStats() {
    const [activeSubscribers, countries, platforms] = await Promise.all([
      this.getActiveSubscriberCount(),
      this.getCountrySummary(),
      this.getPlatformSummary(),
    ]);
    return { activeSubscribers, countries, platforms };
  }

  async getSubscriptionStats() {
    const d = await this.getDashboard();
    return { cancelled: d.cancelled, trial: d.freeTrials };
  }
}
