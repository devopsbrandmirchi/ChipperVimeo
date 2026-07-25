import type {
  Customer,
  CustomerInsert,
  CustomerSubscriptionPatch,
  CustomerUpdate,
  Payment,
  PaymentInsert,
  PaymentUpdate,
  Product,
  ProductInsert,
  ProductUpdate,
  Subscription,
  SubscriptionEvent,
  SubscriptionEventInsert,
  SubscriptionInsert,
  SubscriptionUpdate,
} from "@/types/database";
import type {
  CustomerSearchOptions,
  DateRangeOptions,
  PaginateOptions,
  PaginatedResult,
  ProductSearchOptions,
  SubscriptionSearchOptions,
} from "@/types/repository";
import type { VottEvent, VottEventFilters } from "@/types/vimeo";

/** Ports widened for Phase 6 reads — structural match to existing repositories. */

export interface ICustomerRepository {
  findByVimeoCustomerId(vimeoCustomerId: number): Promise<Customer | null>;
  findById(id: string): Promise<Customer | null>;
  upsertByVimeoId(row: CustomerInsert): Promise<Customer>;
  update(id: string, patch: CustomerUpdate): Promise<Customer>;
  updateSubscription(
    id: string,
    patch: CustomerSubscriptionPatch,
  ): Promise<Customer>;
  updateLastSeen(id: string, lastSeenAt?: string): Promise<Customer>;
  count(
    filters?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<number>;
  search(options: CustomerSearchOptions): Promise<Customer[]>;
  paginate(opts?: PaginateOptions): Promise<PaginatedResult<Customer>>;
  findAll(options?: {
    limit?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    filters?: Record<string, string | number | boolean | null | undefined>;
  }): Promise<Customer[]>;
}

export interface IProductRepository {
  findByVimeoProductId(vimeoProductId: number): Promise<Product | null>;
  findById(id: string): Promise<Product | null>;
  upsertByVimeoId(row: ProductInsert): Promise<Product>;
  update(id: string, patch: ProductUpdate): Promise<Product>;
  count(
    filters?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<number>;
  search(options: ProductSearchOptions): Promise<Product[]>;
  paginate(opts?: PaginateOptions): Promise<PaginatedResult<Product>>;
  findActive(limit?: number): Promise<Product[]>;
  findInactive(limit?: number): Promise<Product[]>;
}

export interface ISubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findCurrent(
    customerId: string,
    productId: string,
  ): Promise<Subscription | null>;
  create(row: SubscriptionInsert): Promise<Subscription>;
  update(id: string, patch: SubscriptionUpdate): Promise<Subscription>;
  count(
    filters?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<number>;
  search(options: SubscriptionSearchOptions): Promise<Subscription[]>;
  paginate(opts?: PaginateOptions): Promise<PaginatedResult<Subscription>>;
  findAll(options?: {
    limit?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    filters?: Record<string, string | number | boolean | null | undefined>;
  }): Promise<Subscription[]>;
}

export interface ISubscriptionEventRepository {
  create(row: SubscriptionEventInsert): Promise<SubscriptionEvent>;
  findByVottEventId(vottEventId: string): Promise<SubscriptionEvent | null>;
  findTimeline(customerId: string): Promise<SubscriptionEvent[]>;
}

export interface IPaymentRepository {
  create(row: PaymentInsert): Promise<Payment>;
  update(id: string, patch: PaymentUpdate): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  count(
    filters?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<number>;
  paginate(opts?: PaginateOptions): Promise<PaginatedResult<Payment>>;
  findByCustomer(customerId: string): Promise<Payment[]>;
  findBySubscription(subscriptionId: string): Promise<Payment[]>;
  findBetweenDates(options: DateRangeOptions): Promise<Payment[]>;
  findFailed(limit?: number): Promise<Payment[]>;
  findSuccessful(limit?: number): Promise<Payment[]>;
}

export interface IVottEventRepository {
  findById(id: string): Promise<VottEvent | null>;
  list(filters?: VottEventFilters): Promise<VottEvent[]>;
  paginate(opts?: PaginateOptions): Promise<PaginatedResult<VottEvent>>;
  findByTopic(topic: string, limit?: number): Promise<VottEvent[]>;
  findBetweenDates(options: DateRangeOptions): Promise<VottEvent[]>;
  findCustomerEvents(customerId: number, limit?: number): Promise<VottEvent[]>;
  findProductEvents(productId: number, limit?: number): Promise<VottEvent[]>;
  count(
    filters?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<number>;
}
