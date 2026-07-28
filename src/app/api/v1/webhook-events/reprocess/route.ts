import type { NextRequest } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { mapApiError } from "@/app/api/v1/_shared/api-error-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { requireRole } from "@/auth/guards/role.guard";
import { createServiceClient } from "@/lib/supabase/server";
import { defaultLogger } from "@/processors/logger/logger";
import { WebhookProcessingService } from "@/processors/webhook-processing.service";

const bodySchema = z.object({
  kind: z.enum(["gain", "loss"]).optional().default("gain"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(500),
});

function hasValidReprocessSecret(request: NextRequest): boolean {
  const expected = process.env.REPROCESS_SECRET;
  if (!expected || expected.length < 16) return false;
  const provided = request.headers.get("x-reprocess-secret");
  return Boolean(provided && provided === expected);
}

async function runReprocess(
  body: z.infer<typeof bodySchema>,
  requestId: string,
) {
  const processor = new WebhookProcessingService({
    client: createServiceClient(),
  });
  const data =
    body.kind === "loss"
      ? await processor.reprocessUnprocessedLossEvents(body)
      : await processor.reprocessUnprocessedGainEvents(body);
  return successResponse(
    data,
    body.kind === "loss"
      ? "Loss-event reprocess batch finished"
      : "Gain-event reprocess batch finished",
    { requestId },
  );
}

/**
 * ADMIN session or Edge Function (`x-reprocess-secret`):
 * replay unprocessed gain or loss vott_events into subscription_events.
 *
 * POST /api/v1/webhook-events/reprocess
 * Body: { kind?: "gain"|"loss", startDate, endDate, limit? }
 */
export async function POST(
  request: NextRequest,
  routeCtx?: { params: Promise<Record<string, string>> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const providedSecret = request.headers.get("x-reprocess-secret");

  if (providedSecret) {
    if (!hasValidReprocessSecret(request)) {
      return Response.json(
        {
          success: false,
          message:
            "Invalid or missing REPROCESS_SECRET on the app (set on Vercel, min 16 chars, redeploy)",
          errors: [
            {
              code: "unauthorized",
              message:
                "x-reprocess-secret did not match process.env.REPROCESS_SECRET",
            },
          ],
        },
        { status: 401, headers: { "x-request-id": requestId } },
      );
    }
    try {
      const raw: unknown = await request.json().catch(() => ({}));
      const body = bodySchema.parse(raw ?? {});
      return await runReprocess(body, requestId);
    } catch (error) {
      defaultLogger.error("Reprocess (secret) failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return mapApiError(error, requestId);
    }
  }

  return createApiHandler(async ({ request: req, requestId: id, user }) => {
    requireRole(user, "ADMIN");
    const raw: unknown = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw ?? {});
    return runReprocess(body, id);
  })(request, routeCtx);
}
