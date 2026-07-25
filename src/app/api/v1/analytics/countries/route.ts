import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { parseAnalyticsFilters } from "@/modules/analytics/controller/analytics.controller";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const filters = parseAnalyticsFilters(request);
  const { analytics } = createApiServices();
  const data = await analytics.getCountryAnalytics(filters);
  return successResponse(data, "Country analytics retrieved successfully", {
    requestId,
  });
});
