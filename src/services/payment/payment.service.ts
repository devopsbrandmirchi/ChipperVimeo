import type { Logger } from "@/processors/logger/logger";
import { asJson } from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import { DuplicateEntityError } from "@/services/shared/errors";
import { ServiceValidationError } from "@/services/shared/errors";
import type { ICustomerService } from "@/services/interfaces/customer-service.interface";
import type {
  IPaymentService,
  RecordPaymentInput,
} from "@/services/interfaces/payment-service.interface";
import type {
  ICustomerRepository,
  IPaymentRepository,
  IProductRepository,
} from "@/services/interfaces/repositories";
import type { Payment } from "@/types/database";
import { RepositoryError } from "@/types/errors";
import type {
  PaymentListFilters,
  PaymentListItem,
  ResourceStatistics,
} from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";
import { toPaginateOptions } from "@/types/pagination";

const EXPORT_MAX_ROWS = 10_000;

export class PaymentService extends BaseService implements IPaymentService {
  constructor(
    private readonly payments: IPaymentRepository,
    private readonly customers: ICustomerService,
    private readonly customerRepo: ICustomerRepository,
    private readonly productRepo: IProductRepository,
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

  async getById(id: string): Promise<PaymentListItem> {
    return this.timed("getById", async () => {
      try {
        const row = await this.payments.findById(id);
        const payment = this.requireFound(row, "payment", id);
        const [enriched] = await this.enrich([payment]);
        return enriched;
      } catch (error) {
        this.mapRepositoryError(error, "getById");
      }
    });
  }

  async list(
    filters: PaymentListFilters = {},
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<PaymentListItem>> {
    return this.timed("list", async () => {
      try {
        const opts = toPaginateOptions(page, "payment_date");
        const result = await this.payments.paginateFiltered({
          status: filters.status,
          customerId: filters.customerId,
          subscriptionId: filters.subscriptionId,
          productId: filters.productId,
          currency: filters.currency,
          from: filters.from,
          to: filters.to,
          page: opts.page,
          pageSize: opts.pageSize,
          sortBy: opts.sortBy,
          sortDirection: opts.sortDirection,
        });
        const items = await this.enrich(result.items);
        return { ...result, items };
      } catch (error) {
        this.mapRepositoryError(error, "list");
      }
    });
  }

  async listForExport(
    filters: PaymentListFilters = {},
  ): Promise<{ items: PaymentListItem[]; total: number }> {
    return this.timed("listForExport", async () => {
      try {
        const result = await this.payments.paginateFiltered({
          status: filters.status,
          customerId: filters.customerId,
          subscriptionId: filters.subscriptionId,
          productId: filters.productId,
          currency: filters.currency,
          from: filters.from,
          to: filters.to,
          page: 1,
          pageSize: EXPORT_MAX_ROWS,
          sortBy: "payment_date",
          sortDirection: "desc",
        });
        if (result.total > EXPORT_MAX_ROWS) {
          throw new ServiceValidationError(
            `Export exceeds ${EXPORT_MAX_ROWS} rows (${result.total}). Narrow filters.`,
          );
        }
        const items = await this.enrich(result.items);
        return { items, total: result.total };
      } catch (error) {
        this.mapRepositoryError(error, "listForExport");
      }
    });
  }

  async findBetweenDates(
    from: string,
    to: string,
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<PaymentListItem>> {
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

  private async enrich(rows: Payment[]): Promise<PaymentListItem[]> {
    if (rows.length === 0) return [];
    const customerIds = rows.map((r) => r.customer_id).filter(Boolean);
    const productIds = rows
      .map((r) => r.product_id)
      .filter((id): id is string => Boolean(id));

    const [customers, products] = await Promise.all([
      this.customerRepo.findByIds(customerIds),
      this.productRepo.findByIds(productIds),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    return rows.map((row) => {
      const customer = customerMap.get(row.customer_id);
      const product = row.product_id
        ? productMap.get(row.product_id)
        : undefined;
      return {
        ...row,
        customer_email: customer?.email ?? null,
        customer_name: customer?.full_name ?? null,
        product_name: product?.name ?? product?.sku ?? null,
      };
    });
  }
}
