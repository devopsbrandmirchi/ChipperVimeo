import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  AuthError,
  ForbiddenError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "@/auth/types/errors";
import {
  buildError,
  buildSuccess,
  type ApiErrorDetail,
  type BaseApiResponse,
} from "@/types/api-response";

export function authSuccess<T>(
  data: T,
  message: string,
  status = 200,
): NextResponse<BaseApiResponse<T>> {
  return NextResponse.json(buildSuccess(data, message), { status });
}

export function authErrorResponse(
  message: string,
  status: number,
  errors?: ApiErrorDetail[],
): NextResponse<BaseApiResponse<never>> {
  return NextResponse.json(buildError(message, errors), { status });
}

export function mapAuthError(
  error: unknown,
): NextResponse<BaseApiResponse<never>> {
  if (error instanceof ZodError) {
    return authErrorResponse(
      "Invalid request",
      400,
      error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.length > 0 ? issue.path.join(".") : undefined,
      })),
    );
  }

  if (error instanceof UnauthorizedError) {
    return authErrorResponse(error.message, 401, [
      { code: error.code, message: error.message },
    ]);
  }

  if (error instanceof ForbiddenError) {
    return authErrorResponse(error.message, 403, [
      { code: error.code, message: error.message },
    ]);
  }

  if (error instanceof InvalidCredentialsError) {
    return authErrorResponse(error.message, 401, [
      { code: error.code, message: error.message },
    ]);
  }

  if (error instanceof AuthError) {
    return authErrorResponse(error.message, 400, [
      { code: error.code, message: error.message },
    ]);
  }

  const message =
    error instanceof Error ? error.message : "Authentication error";
  return authErrorResponse("Authentication error", 500, [
    { code: "internal_error", message },
  ]);
}
