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

/** Narrow ports — structural match to existing repositories (no repo edits). */

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
  count(filters?: Record<string, string | number | boolean | null | undefined>): Promise<number>;
}

export interface IProductRepository {
  findByVimeoProductId(vimeoProductId: number): Promise<Product | null>;
  findById(id: string): Promise<Product | null>;
  upsertByVimeoId(row: ProductInsert): Promise<Product>;
  update(id: string, patch: ProductUpdate): Promise<Product>;
  count(filters?: Record<string, string | number | boolean | null | undefined>): Promise<number>;
}

export interface ISubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findCurrent(
    customerId: string,
    productId: string,
  ): Promise<Subscription | null>;
  create(row: SubscriptionInsert): Promise<Subscription>;
  update(id: string, patch: SubscriptionUpdate): Promise<Subscription>;
  count(filters?: Record<string, string | number | boolean | null | undefined>): Promise<number>;
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
  count(filters?: Record<string, string | number | boolean | null | undefined>): Promise<number>;
}
