import { z } from "zod";

export const pageSchema = z.coerce.number().int().min(1).default(1);
export const pageSizeSchema = z.coerce.number().int().min(1).max(200).default(25);
export const directionSchema = z.enum(["asc", "desc"]).default("desc");
export const uuidSchema = z.string().uuid();
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const baseListQuerySchema = z.object({
  page: pageSchema.optional(),
  pageSize: pageSizeSchema.optional(),
  sort: z.string().min(1).optional(),
  direction: directionSchema.optional(),
  search: z.string().min(1).optional(),
});

export const customerListQuerySchema = baseListQuerySchema.extend({
  status: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  country: z.string().optional(),
  platform: z.string().optional(),
  plan: z.string().optional(),
  productId: z.string().uuid().optional(),
  signupFrom: dateStringSchema.optional(),
  signupTo: dateStringSchema.optional(),
  sort: z
    .enum([
      "created_at",
      "updated_at",
      "last_seen_at",
      "email",
      "full_name",
      "country",
      "platform",
    ])
    .optional(),
});

export const subscriptionListQuerySchema = baseListQuerySchema.extend({
  status: z.string().optional(),
  billingFrequency: z.string().optional(),
  productId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  trial: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  renewalFrom: dateStringSchema.optional(),
  renewalTo: dateStringSchema.optional(),
  sort: z
    .enum([
      "created_at",
      "started_at",
      "renewal_date",
      "next_payment_date",
      "status",
    ])
    .optional(),
});

export const productListQuerySchema = baseListQuerySchema.extend({
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sku: z.string().optional(),
  name: z.string().optional(),
  sort: z.enum(["created_at", "name", "updated_at", "sku"]).optional(),
});

export const paymentListQuerySchema = baseListQuerySchema.extend({
  status: z.string().optional(),
  customerId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  currency: z.string().optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  sort: z
    .enum(["created_at", "payment_date", "amount_cents", "status"])
    .optional(),
});

export const webhookEventListQuerySchema = baseListQuerySchema.extend({
  topic: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  email: z.string().optional(),
  productId: z.coerce.number().int().optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  sort: z.enum(["received_at", "event_created_at", "topic"]).optional(),
});

export function parseSearchParams<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams,
): z.infer<T> {
  const raw = Object.fromEntries(searchParams.entries());
  return schema.parse(raw);
}
