import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import {
  parseSearchParams,
  productListQuerySchema,
} from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const query = parseSearchParams(
    productListQuerySchema,
    request.nextUrl.searchParams,
  );
  const { products } = createApiServices();
  const result = await products.list(
    {
      active: query.active,
      sku: query.sku,
      name: query.name,
      search: query.search,
    },
    {
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      direction: query.direction,
    },
  );

  return successResponse(result.items, "Products retrieved successfully", {
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
    requestId,
  });
});
