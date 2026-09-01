import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { csvResponse, rowsToCsv } from "@/app/api/v1/_shared/csv";
import {
  parseSearchParams,
  paymentListQuerySchema,
} from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const query = parseSearchParams(
    paymentListQuerySchema,
    request.nextUrl.searchParams,
  );
  const { payments } = createApiServices();
  const { items } = await payments.listForExport({
    status: query.status,
    customerId: query.customerId,
    subscriptionId: query.subscriptionId,
    productId: query.productId,
    currency: query.currency,
    from: query.from,
    to: query.to,
  });

  const csv = rowsToCsv(
    [
      "id",
      "payment_date",
      "status",
      "amount_cents",
      "currency",
      "customer_id",
      "customer_email",
      "customer_name",
      "product_id",
      "product_name",
      "subscription_id",
      "payment_provider",
      "transaction_reference",
      "failure_reason",
      "promotion_code",
    ],
    items.map((p) => [
      p.id,
      p.payment_date,
      p.status,
      p.amount_cents,
      p.currency,
      p.customer_id,
      p.customer_email,
      p.customer_name,
      p.product_id,
      p.product_name,
      p.subscription_id,
      p.payment_provider,
      p.transaction_reference,
      p.failure_reason,
      p.promotion_code,
    ]),
  );

  return csvResponse("payments-export.csv", csv, requestId);
});
