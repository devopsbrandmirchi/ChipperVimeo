import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { parseCohortMatrixFilters } from "@/modules/analytics/controller/analytics.controller";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const filters = parseCohortMatrixFilters(request);
  const { analytics } = createApiServices();
  const data = await analytics.getCohortTrialConversion(filters);
  return successResponse(
    data,
    "Cohort trial conversion retrieved successfully",
    { requestId },
  );
});
