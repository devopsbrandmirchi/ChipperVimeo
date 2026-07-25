import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { uuidSchema } from "@/app/api/v1/_shared/schemas";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ params, requestId }) => {
  const id = uuidSchema.parse(params.id);
  const { customers } = createApiServices();
  const customer = await customers.getById(id);
  return successResponse(customer, "Customer retrieved successfully", {
    requestId,
  });
});
