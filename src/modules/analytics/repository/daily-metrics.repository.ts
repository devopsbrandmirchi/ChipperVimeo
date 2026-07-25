import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsFilters } from "@/modules/analytics/dto/filters";
import type {
  DailyCountryMetricRow,
  DailyCustomerMetricRow,
  DailyPaymentMetricRow,
  DailyPlatformMetricRow,
  DailyProductMetricRow,
  DailySubscriptionMetricRow,
  DailyTrialMetricRow,
} from "@/modules/analytics/types/daily-rows";
import { RepositoryError } from "@/types/errors";

/**
 * Reads/writes analytics.daily_* snapshots. Never queries vott_events.
 */
export class DailyMetricsRepository {
  constructor(private readonly client: SupabaseClient) {}

  private db() {
    return this.client.schema("analytics");
  }

  private throwMapped(
    error: { message: string; code?: string },
    op: string,
  ): never {
    throw new RepositoryError("DatabaseError", `${op}: ${error.message}`, {
      cause: error,
      table: "analytics.daily_*",
    });
  }

  private dateBounds(filters: AnalyticsFilters): {
    from: string | null;
    to: string | null;
  } {
    const single = filters.date;
    return {
      from: filters.dateFrom ?? single ?? null,
      to: filters.dateTo ?? single ?? null,
    };
  }

  async buildForDate(date: string): Promise<void> {
    const { error } = await this.db().rpc("build_daily_snapshots", {
      p_date: date,
    });
    if (error) this.throwMapped(error, "build_daily_snapshots");
  }

  async earliestMetricsDate(): Promise<string | null> {
    const { data, error } = await this.db().rpc("earliest_metrics_date");
    if (error) this.throwMapped(error, "earliest_metrics_date");
    if (data == null) return null;
    return String(data);
  }

  async listSubscriptionMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailySubscriptionMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_subscription_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listSubscriptionMetrics");
    return (data as DailySubscriptionMetricRow[]) ?? [];
  }

  async listTrialMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailyTrialMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_trial_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listTrialMetrics");
    return (data as DailyTrialMetricRow[]) ?? [];
  }

  async listPaymentMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailyPaymentMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_payment_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listPaymentMetrics");
    return (data as DailyPaymentMetricRow[]) ?? [];
  }

  async listCustomerMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailyCustomerMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_customer_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listCustomerMetrics");
    return (data as DailyCustomerMetricRow[]) ?? [];
  }

  async listProductMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailyProductMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_product_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    if (filters.productId) q = q.eq("product_id", filters.productId);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listProductMetrics");
    return (data as DailyProductMetricRow[]) ?? [];
  }

  async listCountryMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailyCountryMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_country_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    if (filters.country) q = q.eq("country", filters.country);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listCountryMetrics");
    return (data as DailyCountryMetricRow[]) ?? [];
  }

  async listPlatformMetrics(
    filters: AnalyticsFilters = {},
  ): Promise<DailyPlatformMetricRow[]> {
    const { from, to } = this.dateBounds(filters);
    let q = this.db()
      .from("daily_platform_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    if (filters.platform) q = q.eq("platform", filters.platform);
    const { data, error } = await q;
    if (error) this.throwMapped(error, "listPlatformMetrics");
    return (data as DailyPlatformMetricRow[]) ?? [];
  }
}
