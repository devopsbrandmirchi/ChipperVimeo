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

/**
 * Gain/loss metrics from analytics.fn_subscription_metrics.
 * Never queries vott_events.
 */
export class SubscriptionMetricsRepository {
  constructor(private readonly client: SupabaseClient) {}

  private db() {
    return this.client.schema("analytics");
  }

  async listMetrics(params: {
    startDate: string;
    endDate: string;
    platform?: string;
    country?: string;
    productId?: string;
  }): Promise<SubscriptionMetricsDbRow[]> {
    const { data, error } = await this.db().rpc("fn_subscription_metrics", {
      p_start_date: params.startDate,
      p_end_date: params.endDate,
      p_platform: params.platform ?? null,
      p_country: params.country ?? null,
      p_product_id: params.productId ?? null,
    });
    if (error) {
      throw new RepositoryError(
        "DatabaseError",
        `fn_subscription_metrics: ${error.message}`,
        { cause: error, table: "analytics.v_daily_subscription_metrics" },
      );
    }
    return (data as SubscriptionMetricsDbRow[]) ?? [];
  }
}
