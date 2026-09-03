import type { SupabaseClient } from "@supabase/supabase-js";

import { RepositoryError } from "@/types/errors";

export type SubscriptionMetricsDbRow = {
  report_date: string;
  platform: string;
  country: string;
  product_id: string;
  subscription_gain: number;
  subscription_loss: number;
  trial_gain: number;
  trial_loss: number;
  trial_conversion: number;
  combined_gain: number;
  combined_loss: number;
  unique_customers_gain: number;
  unique_customers_loss: number;
};

export type SubscriptionMetricsDayCountryDbRow = {
  report_date: string;
  country: string;
  subscription_gain: number;
  subscription_loss: number;
  trial_gain: number;
  trial_loss: number;
  trial_conversion: number;
  combined_gain: number;
  combined_loss: number;
  unique_customers_gain: number;
  unique_customers_loss: number;
  unique_subscription_gain: number;
  unique_subscription_loss: number;
  unique_trial_gain: number;
  unique_trial_loss: number;
};

export type SubscriptionMetricsGrain = "day" | "platform" | "country" | "product";

export type SubscriptionMetricsGrouped = {
  byDay: SubscriptionMetricsDbRow[];
  byPlatform: SubscriptionMetricsDbRow[];
  byCountry: SubscriptionMetricsDbRow[];
  byProduct: SubscriptionMetricsDbRow[];
};

/**
 * Gain/loss metrics from analytics RPCs.
 * Never queries vott_events.
 */
export class SubscriptionMetricsRepository {
  constructor(private readonly client: SupabaseClient) {}

  private db() {
    return this.client.schema("analytics");
  }

  private async listGrouped(
    grain: SubscriptionMetricsGrain,
    params: {
      startDate: string;
      endDate: string;
      platform?: string;
      country?: string;
      productId?: string;
    },
  ): Promise<SubscriptionMetricsDbRow[]> {
    const { data, error } = await this.db().rpc(
      "fn_subscription_metrics_grouped",
      {
        p_start_date: params.startDate,
        p_end_date: params.endDate,
        p_grain: grain,
        p_platform: params.platform ?? null,
        p_country: params.country ?? null,
        p_product_id: params.productId ?? null,
      },
    );
    if (error) {
      throw new RepositoryError(
        "DatabaseError",
        `fn_subscription_metrics_grouped(${grain}): ${error.message}`,
        { table: "analytics.fn_subscription_metrics_grouped" },
      );
    }
    return ((data as SubscriptionMetricsDbRow[]) ?? []).map((row) => ({
      ...row,
      report_date: row.report_date ?? "",
      platform: row.platform ?? "",
      country: row.country ?? "",
      product_id: row.product_id ?? "",
    }));
  }

  /**
   * Compact per-grain fetches. Prefers single-scan all-grains RPC when available;
   * falls back to four parallel grain calls (legacy).
   */
  async listMetricsGrouped(params: {
    startDate: string;
    endDate: string;
    platform?: string;
    country?: string;
    productId?: string;
  }): Promise<SubscriptionMetricsGrouped> {
    try {
      return await this.listMetricsAllGrains(params);
    } catch (error) {
      // Migration 039 not applied yet — keep serving via 4 grain RPCs.
      if (
        error instanceof RepositoryError &&
        /fn_subscription_metrics_all_grains/i.test(error.message)
      ) {
        const [byDay, byPlatform, byCountry, byProduct] = await Promise.all([
          this.listGrouped("day", params),
          this.listGrouped("platform", params),
          this.listGrouped("country", params),
          this.listGrouped("product", params),
        ]);
        return { byDay, byPlatform, byCountry, byProduct };
      }
      throw error;
    }
  }

  private async listMetricsAllGrains(params: {
    startDate: string;
    endDate: string;
    platform?: string;
    country?: string;
    productId?: string;
  }): Promise<SubscriptionMetricsGrouped> {
    const { data, error } = await this.db().rpc(
      "fn_subscription_metrics_all_grains",
      {
        p_start_date: params.startDate,
        p_end_date: params.endDate,
        p_platform: params.platform ?? null,
        p_country: params.country ?? null,
        p_product_id: params.productId ?? null,
      },
    );
    if (error) {
      throw new RepositoryError(
        "DatabaseError",
        `fn_subscription_metrics_all_grains: ${error.message}`,
        { table: "analytics.fn_subscription_metrics_all_grains" },
      );
    }

    const rows = (data as Array<SubscriptionMetricsDbRow & { grain: string }>) ?? [];
    const mapRow = (
      row: SubscriptionMetricsDbRow & { grain?: string },
    ): SubscriptionMetricsDbRow => ({
      ...row,
      report_date: row.report_date ?? "",
      platform: row.platform ?? "",
      country: row.country ?? "",
      product_id: row.product_id ?? "",
      subscription_gain: row.subscription_gain,
      subscription_loss: row.subscription_loss,
      trial_gain: row.trial_gain,
      trial_loss: row.trial_loss,
      trial_conversion: row.trial_conversion,
      combined_gain: row.combined_gain,
      combined_loss: row.combined_loss,
      unique_customers_gain: row.unique_customers_gain,
      unique_customers_loss: row.unique_customers_loss,
    });

    return {
      byDay: rows.filter((r) => r.grain === "day").map(mapRow),
      byPlatform: rows.filter((r) => r.grain === "platform").map(mapRow),
      byCountry: rows.filter((r) => r.grain === "country").map(mapRow),
      byProduct: rows.filter((r) => r.grain === "product").map(mapRow),
    };
  }

  /** @deprecated Prefer listMetricsGrouped — kept for tests / smoke. */
  async listMetrics(params: {
    startDate: string;
    endDate: string;
    platform?: string;
    country?: string;
    productId?: string;
  }): Promise<SubscriptionMetricsDbRow[]> {
    return this.listGrouped("day", params);
  }

  async listDayCountryMetrics(params: {
    startDate: string;
    endDate: string;
    country?: string;
  }): Promise<SubscriptionMetricsDayCountryDbRow[]> {
    const { data, error } = await this.db().rpc(
      "fn_subscription_metrics_day_country",
      {
        p_start_date: params.startDate,
        p_end_date: params.endDate,
        p_country: params.country ?? null,
      },
    );
    if (error) {
      throw new RepositoryError(
        "DatabaseError",
        `fn_subscription_metrics_day_country: ${error.message}`,
        { table: "analytics.v_daily_subscription_country_metrics" },
      );
    }
    return (data as SubscriptionMetricsDayCountryDbRow[]) ?? [];
  }
}
