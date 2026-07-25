import { z } from "zod";

export const analyticsGroupBySchema = z.enum([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

export const analyticsFiltersSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  country: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  productId: z.string().uuid().optional(),
  billingCycle: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  groupBy: analyticsGroupBySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;

export const refreshAnalyticsSchema = z.object({
  target: z
    .enum([
      "all",
      "dashboard",
      "daily_metrics",
      "monthly_metrics",
      "customer_metrics",
      "subscription_metrics",
      "product_metrics",
      "country_metrics",
      "platform_metrics",
      "revenue_metrics",
      "trial_metrics",
      "payment_metrics",
      "churn_metrics",
      "ltv_metrics",
    ])
    .default("all"),
});

export type RefreshAnalyticsInput = z.infer<typeof refreshAnalyticsSchema>;
