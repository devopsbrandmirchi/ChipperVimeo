/** Domain errors thrown by the service layer. Never expose raw DB errors. */

export class ServiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceValidationError";
  }
}

/** Alias matching the Phase 5 brief name. */
export { ServiceValidationError as ValidationError };

export class BusinessRuleViolationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "BusinessRuleViolationError";
  }
}

export class EntityNotFoundError extends Error {
  constructor(
    readonly entity: string,
    readonly id?: string,
    message?: string,
  ) {
    super(message ?? `${entity} not found${id ? `: ${id}` : ""}`);
    this.name = "EntityNotFoundError";
  }
}

export class DuplicateEntityError extends Error {
  constructor(
    readonly entity: string,
    message?: string,
    readonly cause?: unknown,
  ) {
    super(message ?? `Duplicate ${entity}`);
    this.name = "DuplicateEntityError";
  }
}
