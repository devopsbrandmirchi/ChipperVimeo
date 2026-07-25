import type { NextRequest } from "next/server";

import { mapApiError } from "@/app/api/v1/_shared/api-error-handler";
import { requireAuthorizedUser } from "@/auth/guards/auth.guard";
import type { AuthUser } from "@/auth/types/auth";
import { defaultLogger, type Logger } from "@/processors/logger/logger";

export type ApiRouteContext = {
  request: NextRequest;
  requestId: string;
  logger: Logger;
  params: Record<string, string>;
  user: AuthUser;
};

type RouteParams = { params: Promise<Record<string, string>> };

function resolveRequestId(request: NextRequest): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

/**
 * Authenticated API handler for `/api/v1/*`.
 * Requires a valid session and an assigned app role (401 / 403 otherwise).
 */
export function createApiHandler(
  handler: (ctx: ApiRouteContext) => Promise<Response>,
) {
  return async (request: NextRequest, routeCtx?: RouteParams) => {
    const requestId = resolveRequestId(request);
    const logger = defaultLogger.child({
      service: "api-v1",
      requestId,
      method: request.method,
      endpoint: request.nextUrl.pathname,
    });
    const started = Date.now();
    const params = routeCtx?.params ? await routeCtx.params : {};

    try {
      const user = await requireAuthorizedUser();
      const response = await handler({
        request,
        requestId,
        logger,
        params,
        user,
      });
      response.headers.set("x-request-id", requestId);
      logger.info("API request complete", {
        status: response.status,
        durationMs: Date.now() - started,
        success: response.status < 400,
        userId: user.id,
      });
      return response;
    } catch (error) {
      const response = mapApiError(error, requestId);
      logger.error("API request failed", {
        status: response.status,
        durationMs: Date.now() - started,
        success: false,
        error: error instanceof Error ? error.message : "unknown",
      });
      return response;
    }
  };
}
