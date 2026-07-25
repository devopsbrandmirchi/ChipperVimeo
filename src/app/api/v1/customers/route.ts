import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import {
  customerListQuerySchema,
  parseSearchParams,
} from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const query = parseSearchParams(
    customerListQuerySchema,
    request.nextUrl.searchParams,
  );
  const { customers } = createApiServices();
  const result = await customers.list(
    {
      status: query.status,
      subscriptionStatus: query.subscriptionStatus,
      country: query.country,
      platform: query.platform,
      plan: query.plan,
      productId: query.productId,
      signupFrom: query.signupFrom,
      signupTo: query.signupTo,
      search: query.search,
    },
    {
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      direction: query.direction,
    },
  );

  return successResponse(result.items, "Customers retrieved successfully", {
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
    requestId,
  });
});
