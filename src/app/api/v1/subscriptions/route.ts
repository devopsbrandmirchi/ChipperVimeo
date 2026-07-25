import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import {
  parseSearchParams,
  subscriptionListQuerySchema,
} from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const query = parseSearchParams(
    subscriptionListQuerySchema,
    request.nextUrl.searchParams,
  );
  const { subscriptions } = createApiServices();
  const result = await subscriptions.list(
    {
      status: query.status,
      billingFrequency: query.billingFrequency,
      productId: query.productId,
      customerId: query.customerId,
      trial: query.trial,
      renewalFrom: query.renewalFrom,
      renewalTo: query.renewalTo,
    },
    {
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      direction: query.direction,
    },
  );

  return successResponse(
    result.items,
    "Subscriptions retrieved successfully",
    {
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      requestId,
    },
  );
});
