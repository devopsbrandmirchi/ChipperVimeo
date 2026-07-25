import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
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
  const result = await payments.list(
    {
      status: query.status,
      customerId: query.customerId,
      subscriptionId: query.subscriptionId,
      currency: query.currency,
      from: query.from,
      to: query.to,
    },
    {
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      direction: query.direction,
    },
  );

  return successResponse(result.items, "Payments retrieved successfully", {
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
    requestId,
  });
});
