import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { uuidSchema } from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ params, requestId }) => {
  const id = uuidSchema.parse(params.id);
  const { webhookEvents } = createApiServices();
  const event = await webhookEvents.getById(id);
  return successResponse(event, "Webhook event retrieved successfully", {
    requestId,
  });
});
