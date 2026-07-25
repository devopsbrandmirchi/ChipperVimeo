import type { Logger } from "@/processors/logger/logger";
import { RepositoryError } from "@/types/errors";
import {
  BusinessRuleViolationError,
  DuplicateEntityError,
  EntityNotFoundError,
  ServiceValidationError,
} from "@/services/shared/errors";
import {
  normalizePageRequest,
  paginateArray,
  type ApiPageRequest,
  type PaginatedResult,
} from "@/types/pagination";

export abstract class BaseService {
  protected constructor(
    protected readonly serviceName: string,
    protected readonly logger: Logger,
  ) {}

  protected nowIso(): string {
    return new Date().toISOString();
  }

  protected coalesceTimestamp(value: string | null | undefined): string {
    return value && value.length > 0 ? value : this.nowIso();
  }

  protected assertPresent<T>(
    value: T | null | undefined,
    message: string,
  ): T {
    if (value === null || value === undefined) {
      throw new ServiceValidationError(message);
    }
    return value;
  }

  protected normalizePaging(input: ApiPageRequest = {}) {
    return normalizePageRequest(input);
  }

  /** Paginate an in-memory candidate set (used when repo returns ≤200 rows). */
  protected paginateCandidates<T>(
    items: T[],
    input: ApiPageRequest = {},
  ): PaginatedResult<T> {
    const { page, pageSize } = this.normalizePaging(input);
    return paginateArray(items, page, pageSize);
  }

  protected requireFound<T>(
    value: T | null | undefined,
    entity: string,
    id?: string,
  ): T {
    if (value === null || value === undefined) {
      throw new EntityNotFoundError(entity, id);
    }
    return value;
  }

  protected mapRepositoryError(error: unknown, context: string): never {
    if (error instanceof RepositoryError) {
      if (error.code === "NotFound") {
        throw new EntityNotFoundError(
          error.table ?? "entity",
          undefined,
          error.message,
        );
      }
      if (error.code === "UniqueViolation") {
        throw new DuplicateEntityError(
          error.table ?? "entity",
          error.message,
          error,
        );
      }
      throw new BusinessRuleViolationError(
        `${context}: ${error.message}`,
        error,
      );
    }
    if (error instanceof Error) {
      throw new BusinessRuleViolationError(
        `${context}: ${error.message}`,
        error,
      );
    }
    throw new BusinessRuleViolationError(`${context}: unknown error`, error);
  }

  protected async timed<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      this.logger.info("Service operation ok", {
        service: this.serviceName,
        operation,
        durationMs: Date.now() - started,
        success: true,
      });
      return result;
    } catch (error) {
      this.logger.error("Service operation failed", {
        service: this.serviceName,
        operation,
        durationMs: Date.now() - started,
        success: false,
        error: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  }
}
