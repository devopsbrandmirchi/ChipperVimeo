export type RevenueSummary = {
  revenueCents: number;
  currency: string | null;
  note: string;
};

export type DimensionSummary = {
  dimension: string;
  total: number;
  note: string;
};

export type AnalyticsOverview = {
  activeSubscribers: number;
  cancelledSubscriptions: number;
  trialSubscriptions: number;
  revenue: RevenueSummary;
  countries: DimensionSummary;
  platforms: DimensionSummary;
};

export interface IAnalyticsService {
  getActiveSubscriberCount(): Promise<number>;
  getCancelledCount(): Promise<number>;
  getRevenueSummary(): Promise<RevenueSummary>;
  getTrialCount(): Promise<number>;
  getCountrySummary(): Promise<DimensionSummary>;
  getPlatformSummary(): Promise<DimensionSummary>;

  getOverview(): Promise<AnalyticsOverview>;
  getCustomerStats(): Promise<{
    activeSubscribers: number;
    countries: DimensionSummary;
    platforms: DimensionSummary;
  }>;
  getSubscriptionStats(): Promise<{
    cancelled: number;
    trial: number;
  }>;
}
