import { ZodError } from "zod";

import { errorResponse } from "@/app/api/v1/_shared/responses";
import {
  ForbiddenError,
  InvalidCredentialsError,
  UnauthorizedError,
  AuthError,
} from "@/auth/types/errors";
import {
  BusinessRuleViolationError,
  DuplicateEntityError,
  EntityNotFoundError,
  ServiceValidationError,
} from "@/services/shared/errors";
import type { ApiErrorDetail } from "@/types/api-response";

function zodErrors(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.join(".") : undefined,
  }));
}

export function mapApiError(
  error: unknown,
  requestId?: string,
): ReturnType<typeof errorResponse> {
  if (error instanceof ZodError) {
    return errorResponse("Invalid request", 400, {
      errors: zodErrors(error),
      requestId,
    });
  }

  if (
    error instanceof UnauthorizedError ||
    error instanceof InvalidCredentialsError
  ) {
    return errorResponse(error.message, 401, {
      errors: [{ code: error.code, message: error.message }],
      requestId,
    });
  }

  if (error instanceof ForbiddenError) {
    return errorResponse(error.message, 403, {
      errors: [{ code: error.code, message: error.message }],
      requestId,
    });
  }

  if (error instanceof AuthError) {
    return errorResponse(error.message, 400, {
      errors: [{ code: error.code, message: error.message }],
      requestId,
    });
  }

  if (error instanceof EntityNotFoundError) {
    return errorResponse(error.message, 404, {
      errors: [{ code: "not_found", message: error.message }],
      requestId,
    });
  }

  if (error instanceof DuplicateEntityError) {
    return errorResponse(error.message, 409, {
      errors: [{ code: "conflict", message: error.message }],
      requestId,
    });
  }

  if (
    error instanceof ServiceValidationError ||
    error instanceof BusinessRuleViolationError
  ) {
    return errorResponse(error.message, 422, {
      errors: [{ code: "validation_error", message: error.message }],
      requestId,
    });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return errorResponse("Internal server error", 500, {
    errors: [{ code: "internal_error", message }],
    requestId,
  });
}
