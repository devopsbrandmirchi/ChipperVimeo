import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { uuidSchema } from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ params, requestId }) => {
  const id = uuidSchema.parse(params.id);
  const { payments } = createApiServices();
  const payment = await payments.getById(id);
  return successResponse(payment, "Payment retrieved successfully", {
    requestId,
  });
});
