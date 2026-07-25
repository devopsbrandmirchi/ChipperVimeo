/** Auth-layer errors — never expose raw Supabase Auth payloads to clients. */

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unauthorized"
      | "forbidden"
      | "invalid_credentials"
      | "validation"
      | "auth_failed",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = "Authentication required", cause?: unknown) {
    super(message, "unauthorized", cause);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = "Access denied", cause?: unknown) {
    super(message, "forbidden", cause);
    this.name = "ForbiddenError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid email or password", cause?: unknown) {
    super(message, "invalid_credentials", cause);
    this.name = "InvalidCredentialsError";
  }
}
