import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";

const APP_VERSION = "0.1.0";

export const GET = createApiHandler(async ({ requestId }) => {
  return successResponse(
    {
      status: "ok",
      version: APP_VERSION,
      time: new Date().toISOString(),
    },
    "Health check successful",
    { requestId },
  );
});
