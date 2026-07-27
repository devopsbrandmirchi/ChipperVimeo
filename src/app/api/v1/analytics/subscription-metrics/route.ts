import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { parseSubscriptionMetricsFilters } from "@/modules/analytics/controller/analytics.controller";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId }) => {
  const filters = parseSubscriptionMetricsFilters(request);
  const { analytics } = createApiServices();
  const data = await analytics.getSubscriptionGainLossMetrics(filters);
  return successResponse(
    data,
    "Subscription gain/loss metrics retrieved successfully",
    { requestId },
  );
});
