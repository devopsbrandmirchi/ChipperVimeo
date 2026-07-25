import type { Logger } from "@/processors/logger/logger";
import { asJson } from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import { DuplicateEntityError } from "@/services/shared/errors";
import type { ICustomerService } from "@/services/interfaces/customer-service.interface";
import type {
  IPaymentService,
  RecordPaymentInput,
} from "@/services/interfaces/payment-service.interface";
import type { IPaymentRepository } from "@/services/interfaces/repositories";
import type { Payment } from "@/types/database";
import { RepositoryError } from "@/types/errors";
import type { PaymentListFilters, ResourceStatistics } from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";
import { toPaginateOptions } from "@/types/pagination";

export class PaymentService extends BaseService implements IPaymentService {
  constructor(
    private readonly payments: IPaymentRepository,
    private readonly customers: ICustomerService,
    logger: Logger,
  ) {
    super("PaymentService", logger);
  }

  async create(
    input: RecordPaymentInput & { status: string },
  ): Promise<Payment | null> {
    return this.timed("create", async () => {
      const reference = `vimeo:${input.vottEventId}`;
      try {
        const payment = await this.payments.create({
          customer_id: input.customerId,
          subscription_id: input.subscriptionId,
          product_id: input.productId,
          amount_cents: input.amountCents,
          currency: input.currency,
          status: input.status,
          payment_date: input.paymentDate,
          payment_provider: "vimeo",
          transaction_reference: reference,
          failure_reason: input.failureReason ?? null,
          promotion_code: input.promotionCode,
          raw_payment: asJson(input.raw ?? null),
        });

        if (input.paymentDate !== undefined || input.nextPaymentDate !== undefined) {
          await this.customers.updatePaymentDates(
            input.customerId,
            input.paymentDate,
            input.nextPaymentDate ?? null,
          );
        }

        return payment;
      } catch (error) {
        if (
          error instanceof RepositoryError &&
          error.code === "UniqueViolation"
        ) {
          return null;
        }
        if (error instanceof DuplicateEntityError) {
          return null;
        }
        this.mapRepositoryError(error, "create");
      }
    });
  }

  async update(
    id: string,
    patch: Partial<RecordPaymentInput>,
  ): Promise<Payment> {
    return this.timed("update", async () => {
      try {
        return await this.payments.update(id, {
          amount_cents: patch.amountCents,
          currency: patch.currency,
          payment_date: patch.paymentDate,
          promotion_code: patch.promotionCode,
          failure_reason: patch.failureReason,
        });
      } catch (error) {
        this.mapRepositoryError(error, "update");
      }
    });
  }

  async recordRenewal(input: RecordPaymentInput): Promise<Payment | null> {
    return this.create({ ...input, status: "succeeded" });
  }

  async recordFailed(input: RecordPaymentInput): Promise<Payment | null> {
    return this.create({
      ...input,
      status: "failed",
      failureReason: input.failureReason ?? "Vimeo charge_failed webhook",
    });
  }

  async recordRecovered(input: RecordPaymentInput): Promise<Payment | null> {
    return this.create({ ...input, status: "succeeded" });
  }

  async getById(id: string): Promise<Payment> {
    return this.timed("getById", async () => {
      try {
        const row = await this.payments.findById(id);
        return this.requireFound(row, "payment", id);
      } catch (error) {
        this.mapRepositoryError(error, "getById");
      }
    });
  }

  async list(
    filters: PaymentListFilters = {},
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<Payment>> {
    return this.timed("list", async () => {
      try {
        const needsCompose =
          Boolean(filters.from) ||
          Boolean(filters.to) ||
          Boolean(filters.currency) ||
          (Boolean(filters.status) &&
            (Boolean(filters.customerId) || Boolean(filters.subscriptionId)));

        if (needsCompose) {
          let candidates: Payment[];
          if (filters.from && filters.to) {
            candidates = await this.payments.findBetweenDates({
              from: filters.from,
              to: filters.to,
              limit: 200,
            });
          } else if (filters.customerId) {
            candidates = await this.payments.findByCustomer(filters.customerId);
          } else if (filters.subscriptionId) {
            candidates = await this.payments.findBySubscription(
              filters.subscriptionId,
            );
          } else if (filters.status === "failed") {
            candidates = await this.payments.findFailed(200);
          } else if (
            filters.status === "succeeded" ||
            filters.status === "paid"
          ) {
            candidates = await this.payments.findSuccessful(200);
          } else {
            const result = await this.payments.paginate({
              ...toPaginateOptions(page, "payment_date"),
              filters: {
                status: filters.status,
                customer_id: filters.customerId,
                subscription_id: filters.subscriptionId,
                currency: filters.currency,
              },
            });
            return result;
          }

          let filtered = candidates;
          if (filters.status) {
            filtered = filtered.filter((p) => p.status === filters.status);
          }
          if (filters.customerId) {
            filtered = filtered.filter(
              (p) => p.customer_id === filters.customerId,
            );
          }
          if (filters.subscriptionId) {
            filtered = filtered.filter(
              (p) => p.subscription_id === filters.subscriptionId,
            );
          }
          if (filters.currency) {
            filtered = filtered.filter((p) => p.currency === filters.currency);
          }
          return this.paginateCandidates(filtered, page);
        }

        return await this.payments.paginate({
          ...toPaginateOptions(page, "payment_date"),
          filters: {
            status: filters.status,
            customer_id: filters.customerId,
            subscription_id: filters.subscriptionId,
            currency: filters.currency,
          },
        });
      } catch (error) {
        this.mapRepositoryError(error, "list");
      }
    });
  }

  async findBetweenDates(
    from: string,
    to: string,
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<Payment>> {
    return this.list({ from, to }, page);
  }

  async getStatistics(): Promise<ResourceStatistics> {
    return this.timed("getStatistics", async () => {
      try {
        const total = await this.payments.count();
        const succeeded = await this.payments.count({ status: "succeeded" });
        const failed = await this.payments.count({ status: "failed" });
        return {
          total,
          byStatus: { succeeded, failed },
        };
      } catch (error) {
        this.mapRepositoryError(error, "getStatistics");
      }
    });
  }
}
