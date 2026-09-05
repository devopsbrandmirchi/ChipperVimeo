import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsFilters } from "@/modules/analytics/dto/filters";
import type { CohortMatrixDbRow } from "@/modules/analytics/mappers/cohort-matrix.mappers";
import type {
  ChurnMetricRow,
  CountryMetricRow,
  CustomerMetricRow,
  DailyMetricRow,
  DashboardRow,
  DashboardTodayKpiRow,
  LtvMetricRow,
  MonthlyMetricRow,
  PaymentMetricRow,
  PlatformMetricRow,
  ProductMetricRow,
  SubscriptionMetricRow,
  TrialMetricRow,
} from "@/modules/analytics/types/rows";
import { RepositoryError } from "@/types/errors";

type RefreshTarget =
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
  | "ltv_metrics";

const REFRESH_RPC: Record<Exclude<RefreshTarget, "all">, string> = {
  dashboard: "refresh_dashboard",
  daily_metrics: "refresh_daily_metrics",
  monthly_metrics: "refresh_monthly_metrics",
  customer_metrics: "refresh_customer_metrics",
  subscription_metrics: "refresh_subscription_metrics",
  product_metrics: "refresh_product_metrics",
  country_metrics: "refresh_country_metrics",
  platform_metrics: "refresh_platform_metrics",
  revenue_metrics: "refresh_revenue_metrics",
  trial_metrics: "refresh_trial_metrics",
  payment_metrics: "refresh_payment_metrics",
  churn_metrics: "refresh_churn_metrics",
  ltv_metrics: "refresh_ltv_metrics",
};

/**
 * Reads analytics schema only. Never queries public.vott_events.
 */
export class AnalyticsRepository {
  constructor(private readonly client: SupabaseClient) {}

  private db() {
    return this.client.schema("analytics");
  }

  private throwMapped(error: { message: string; code?: string }, op: string): never {
    throw new RepositoryError("DatabaseError", `${op}: ${error.message}`, {
      cause: error,
      table: "analytics",
    });
  }

  async getDashboard(): Promise<DashboardRow | null> {
    const { data, error } = await this.db()
      .from("mv_dashboard")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) this.throwMapped(error, "getDashboard");
    return (data as DashboardRow | null) ?? null;
  }

  async getDashboardTodayKpis(): Promise<DashboardTodayKpiRow | null> {
    const { data, error } = await this.db().rpc("get_dashboard_today_kpis");
    if (error) this.throwMapped(error, "getDashboardTodayKpis");
    const row = Array.isArray(data) ? data[0] : data;
    return (row as DashboardTodayKpiRow | null) ?? null;
  }

  async getSubscriptionMetrics(): Promise<SubscriptionMetricRow | null> {
    const { data, error } = await this.db()
      .from("mv_subscription_metrics")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) this.throwMapped(error, "getSubscriptionMetrics");
    return (data as SubscriptionMetricRow | null) ?? null;
  }

  async getPaymentMetrics(): Promise<PaymentMetricRow | null> {
    const { data, error } = await this.db()
      .from("mv_payment_metrics")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) this.throwMapped(error, "getPaymentMetrics");
    return (data as PaymentMetricRow | null) ?? null;
  }

  async getTrialMetrics(): Promise<TrialMetricRow | null> {
    const { data, error } = await this.db()
      .from("mv_trial_metrics")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) this.throwMapped(error, "getTrialMetrics");
    return (data as TrialMetricRow | null) ?? null;
  }

  async getChurnMetrics(): Promise<ChurnMetricRow | null> {
    const { data, error } = await this.db()
      .from("mv_churn_metrics")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) this.throwMapped(error, "getChurnMetrics");
    return (data as ChurnMetricRow | null) ?? null;
  }

  async getLtvMetrics(): Promise<LtvMetricRow | null> {
    const { data, error } = await this.db()
      .from("mv_ltv_metrics")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) this.throwMapped(error, "getLtvMetrics");
    return (data as LtvMetricRow | null) ?? null;
  }

  async listProductMetrics(): Promise<ProductMetricRow[]> {
    const { data, error } = await this.db()
      .from("mv_product_metrics")
      .select("*")
      .order("revenue_cents", { ascending: false });
    if (error) this.throwMapped(error, "listProductMetrics");
    return (data as ProductMetricRow[]) ?? [];
  }

  async listCountryMetrics(): Promise<CountryMetricRow[]> {
    const { data, error } = await this.db()
      .from("mv_country_metrics")
      .select("*")
      .order("customer_count", { ascending: false });
    if (error) this.throwMapped(error, "listCountryMetrics");
    return (data as CountryMetricRow[]) ?? [];
  }

  async listPlatformMetrics(): Promise<PlatformMetricRow[]> {
    const { data, error } = await this.db()
      .from("mv_platform_metrics")
      .select("*")
      .order("customer_count", { ascending: false });
    if (error) this.throwMapped(error, "listPlatformMetrics");
    return (data as PlatformMetricRow[]) ?? [];
  }

  async getDailyMetrics(filters: AnalyticsFilters): Promise<DailyMetricRow[]> {
    const { data, error } = await this.db().rpc("get_daily_metrics", {
      p_date_from: filters.dateFrom ?? null,
      p_date_to: filters.dateTo ?? null,
    });
    if (error) this.throwMapped(error, "getDailyMetrics");
    return (data as DailyMetricRow[]) ?? [];
  }

  async getMonthlyMetrics(
    filters: AnalyticsFilters,
  ): Promise<MonthlyMetricRow[]> {
    const { data, error } = await this.db().rpc("get_monthly_metrics", {
      p_date_from: filters.dateFrom ?? null,
      p_date_to: filters.dateTo ?? null,
    });
    if (error) this.throwMapped(error, "getMonthlyMetrics");
    return (data as MonthlyMetricRow[]) ?? [];
  }

  async getTopLtvCustomers(limit = 25): Promise<CustomerMetricRow[]> {
    const { data, error } = await this.db().rpc("get_top_ltv_customers", {
      p_limit: limit,
    });
    if (error) this.throwMapped(error, "getTopLtvCustomers");
    return (data as CustomerMetricRow[]) ?? [];
  }

  async getCustomersInTrial(limit = 100): Promise<CustomerMetricRow[]> {
    const { data, error } = await this.db().rpc("get_customers_in_trial", {
      p_limit: limit,
    });
    if (error) this.throwMapped(error, "getCustomersInTrial");
    return (data as CustomerMetricRow[]) ?? [];
  }

  async getCustomersFailedPayments(limit = 100): Promise<CustomerMetricRow[]> {
    const { data, error } = await this.db().rpc(
      "get_customers_failed_payments",
      { p_limit: limit },
    );
    if (error) this.throwMapped(error, "getCustomersFailedPayments");
    return (data as CustomerMetricRow[]) ?? [];
  }

  async getRecentlyCancelledCustomers(
    limit = 100,
  ): Promise<CustomerMetricRow[]> {
    const { data, error } = await this.db().rpc(
      "get_recently_cancelled_customers",
      { p_limit: limit },
    );
    if (error) this.throwMapped(error, "getRecentlyCancelledCustomers");
    return (data as CustomerMetricRow[]) ?? [];
  }

  async getCohortRevenueChurnMatrix(params: {
    from: string;
    to: string;
    horizon: number;
  }): Promise<CohortMatrixDbRow[]> {
    const { data, error } = await this.db().rpc(
      "fn_cohort_revenue_churn_matrix",
      {
        p_from: params.from,
        p_to: params.to,
        p_horizon: params.horizon,
      },
    );
    if (error) this.throwMapped(error, "fn_cohort_revenue_churn_matrix");
    return (data as CohortMatrixDbRow[]) ?? [];
  }

  async getCohortTrialConversion(params: {
    from: string;
    to: string;
  }): Promise<
    Array<{
      cohort_month: string;
      trials_started: number | string | null;
      trials_converted: number | string | null;
      conversion_pct: number | string | null;
    }>
  > {
    const { data, error } = await this.db().rpc("fn_cohort_trial_conversion", {
      p_from: params.from,
      p_to: params.to,
    });
    if (error) this.throwMapped(error, "fn_cohort_trial_conversion");
    return (
      (data as Array<{
        cohort_month: string;
        trials_started: number | string | null;
        trials_converted: number | string | null;
        conversion_pct: number | string | null;
      }>) ?? []
    );
  }

  async refresh(target: RefreshTarget = "all"): Promise<void> {
    if (target === "all") {
      const { error } = await this.db().rpc("refresh_all");
      if (error) this.throwMapped(error, "refresh_all");
      return;
    }
    const fn = REFRESH_RPC[target];
    const { error } = await this.db().rpc(fn);
    if (error) this.throwMapped(error, fn);
  }
}
