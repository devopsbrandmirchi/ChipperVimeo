/** Typed application errors thrown by the repository layer. */

export type RepositoryErrorCode =
  | "NotFound"
  | "UniqueViolation"
  | "ForeignKeyViolation"
  | "CheckViolation"
  | "DatabaseError"
  | "NotSupported";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly table?: string;
  readonly cause?: unknown;

  constructor(
    code: RepositoryErrorCode,
    message: string,
    options?: { table?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.table = options?.table;
    this.cause = options?.cause;
  }
}
