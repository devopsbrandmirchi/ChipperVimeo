import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import {
  parseSearchParams,
  webhookEventListQuerySchema,
} from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const query = parseSearchParams(
    webhookEventListQuerySchema,
    request.nextUrl.searchParams,
  );
  const { webhookEvents } = createApiServices();
  const result = await webhookEvents.list(
    {
      topic: query.topic,
      customerId: query.customerId,
      email: query.email,
      productId: query.productId,
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

  return successResponse(
    result.items,
    "Webhook events retrieved successfully",
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
