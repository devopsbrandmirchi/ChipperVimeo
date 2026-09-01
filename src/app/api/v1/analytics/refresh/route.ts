import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { requireRole } from "@/auth/guards/role.guard";
import { parseRefreshBody } from "@/modules/analytics/controller/analytics.controller";
import { createApiServices } from "@/lib/api/service-container";

/** Allow long MV refresh (Vercel / Node server). */
export const maxDuration = 300;

export const POST = createApiHandler(async ({ request, requestId, user }) => {
  requireRole(user, "ADMIN");
  const body = await parseRefreshBody(request);
  const { analytics } = createApiServices();
  const data = await analytics.refresh(body.target);
  return successResponse(data, "Analytics refresh completed successfully", {
    requestId,
  });
});
