import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ requestId }) => {
  const { analytics } = createApiServices();
  const data = await analytics.getPlatformSummary();
  return successResponse(data, "Platform analytics retrieved successfully", {
    requestId,
  });
});
