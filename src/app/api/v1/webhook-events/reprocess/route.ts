import { z } from "zod";

import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { requireRole } from "@/auth/guards/role.guard";
import { createServiceClient } from "@/lib/supabase/server";
import { WebhookProcessingService } from "@/processors/webhook-processing.service";

const bodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(500),
});

/**
 * ADMIN: replay gain-topic vott_events that never produced subscription_events.
 * POST /api/v1/webhook-events/reprocess
 * Body: { startDate, endDate, limit? }
 *
 * Call repeatedly until attempted === 0 (batches of `limit`).
 */
export const POST = createApiHandler(async ({ request, requestId, user }) => {
  requireRole(user, "ADMIN");
  const raw: unknown = await request.json().catch(() => ({}));
  const body = bodySchema.parse(raw ?? {});

  const processor = new WebhookProcessingService({
    client: createServiceClient(),
  });
  const data = await processor.reprocessUnprocessedGainEvents(body);

  return successResponse(data, "Gain-event reprocess batch finished", {
    requestId,
  });
});
