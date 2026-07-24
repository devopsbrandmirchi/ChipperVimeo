export class ProcessingError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ProcessingError";
    this.cause = cause;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnknownTopicError extends Error {
  readonly topic: string | null;

  constructor(topic: string | null) {
    super(`Unknown webhook topic: ${topic ?? "(null)"}`);
    this.name = "UnknownTopicError";
    this.topic = topic;
  }
}
