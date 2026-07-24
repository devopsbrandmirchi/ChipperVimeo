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
}
