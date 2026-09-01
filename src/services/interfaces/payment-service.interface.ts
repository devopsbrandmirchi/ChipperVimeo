import type { Payment } from "@/types/database";
import type {
  PaymentListFilters,
  PaymentListItem,
  ResourceStatistics,
} from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";

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
  nextPaymentDate?: string | null;
};

export interface IPaymentService {
  create(
    input: RecordPaymentInput & { status: string },
  ): Promise<Payment | null>;
  update(id: string, patch: Partial<RecordPaymentInput>): Promise<Payment>;
  recordRenewal(input: RecordPaymentInput): Promise<Payment | null>;
  recordFailed(input: RecordPaymentInput): Promise<Payment | null>;
  recordRecovered(input: RecordPaymentInput): Promise<Payment | null>;

  getById(id: string): Promise<PaymentListItem>;
  list(
    filters?: PaymentListFilters,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<PaymentListItem>>;
  listForExport(
    filters?: PaymentListFilters,
  ): Promise<{ items: PaymentListItem[]; total: number }>;
  findBetweenDates(
    from: string,
    to: string,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<PaymentListItem>>;
  getStatistics(): Promise<ResourceStatistics>;
}
