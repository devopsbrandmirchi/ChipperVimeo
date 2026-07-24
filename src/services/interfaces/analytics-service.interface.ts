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

export interface IAnalyticsService {
  getActiveSubscriberCount(): Promise<number>;
  getCancelledCount(): Promise<number>;
  getRevenueSummary(): Promise<RevenueSummary>;
  getTrialCount(): Promise<number>;
  getCountrySummary(): Promise<DimensionSummary>;
  getPlatformSummary(): Promise<DimensionSummary>;
}
