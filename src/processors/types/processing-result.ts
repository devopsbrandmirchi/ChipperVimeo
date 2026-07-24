export type ProcessingStatus =
  | "processed"
  | "already_processed"
  | "skipped"
  | "failed";

export type ProcessingResult = {
  status: ProcessingStatus;
  vottEventId: string;
  topic: string | null;
  handler: string;
  durationMs: number;
  error?: string;
};
