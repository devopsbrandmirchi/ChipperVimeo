import type { Payment } from "@/types/database";

export type RecordPaymentInput = {
  customerId: string;
  subscriptionId: string;
  productId: string;
  vottEventId: string;
  amountCents: number | null;
  currency: string | null;
  paymentDate: string | null;
  promotionCode: string | null;
  failureReason?: string | null;
  raw?: unknown;
  /** Also update customer last/next payment dates when provided. */
  nextPaymentDate?: string | null;
};

export interface IPaymentService {
  create(input: RecordPaymentInput & { status: string }): Promise<Payment | null>;
  update(id: string, patch: Partial<RecordPaymentInput>): Promise<Payment>;
  recordRenewal(input: RecordPaymentInput): Promise<Payment | null>;
  recordFailed(input: RecordPaymentInput): Promise<Payment | null>;
  recordRecovered(input: RecordPaymentInput): Promise<Payment | null>;
}
