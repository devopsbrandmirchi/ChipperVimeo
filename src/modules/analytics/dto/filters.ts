import { z } from "zod";

export const analyticsGroupBySchema = z.enum([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

export const analyticsFiltersSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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

export const buildDailyAnalyticsSchema = z
  .object({
    mode: z.enum(["all"]).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "all") return;
    if (val.date) return;
    if (val.dateFrom && val.dateTo) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Provide mode=all, or date, or both dateFrom and dateTo (YYYY-MM-DD)",
    });
  });

export type BuildDailyAnalyticsInput = z.infer<typeof buildDailyAnalyticsSchema>;

export const subscriptionMetricsPresetSchema = z.enum([
  "today",
  "yesterday",
  "last7",
  "last30",
  "custom",
]);

export const subscriptionMetricsGroupBySchema = z.enum([
  "day",
  "platform",
  "country",
  "product",
]);

export const subscriptionMetricsFiltersSchema = z.object({
  preset: subscriptionMetricsPresetSchema.optional().default("yesterday"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  platform: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  productId: z.string().uuid().optional(),
  groupBy: subscriptionMetricsGroupBySchema.optional().default("day"),
});

export type SubscriptionMetricsFilters = z.infer<
  typeof subscriptionMetricsFiltersSchema
>;

export const cohortMatrixFiltersSchema = z.object({
  /** First cohort month (YYYY-MM-01 or YYYY-MM-DD). */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/)
    .optional(),
  /** Last cohort month (YYYY-MM-01 or YYYY-MM-DD). */
  to: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/)
    .optional(),
  /** Relative months across (Month 1..N). Default 6. */
  horizon: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export type CohortMatrixFilters = z.infer<typeof cohortMatrixFiltersSchema>;
