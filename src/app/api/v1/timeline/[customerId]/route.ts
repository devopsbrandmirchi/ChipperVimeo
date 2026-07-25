import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { uuidSchema } from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ params, requestId }) => {
  const customerId = uuidSchema.parse(params.customerId);
  const { timeline } = createApiServices();
  const events = await timeline.getCustomerTimeline(customerId);
  return successResponse(events, "Customer timeline retrieved successfully", {
    requestId,
  });
});
