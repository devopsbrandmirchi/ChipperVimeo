export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Structured logger. Handlers/services must use this instead of console.log.
 * Implementation uses console.* once here so a future sink can replace it.
 */
export class Logger {
  constructor(private readonly defaultFields: LogFields = {}) {}

  child(fields: LogFields): Logger {
    return new Logger({ ...this.defaultFields, ...fields });
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  private write(
    level: "info" | "warn" | "error",
    message: string,
    fields?: LogFields,
  ): void {
    const entry = {
      level,
      message,
      ts: new Date().toISOString(),
      ...this.defaultFields,
      ...fields,
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.info(line);
    }
  }
}

export const defaultLogger = new Logger({ service: "event-processor" });
