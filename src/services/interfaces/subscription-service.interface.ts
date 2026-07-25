import type { Customer, Product, Subscription } from "@/types/database";
import type { VimeoCustomer } from "@/types/vimeo";
import type {
  ResourceStatistics,
  SubscriptionListFilters,
} from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";

export type SubscriptionLifecycleInput = {
  customer: Customer;
  product: Product;
  vimeoCustomer: VimeoCustomer;
  eventCreatedAt: string | null;
  vottEventId: string;
  vimeoCustomerId: number;
  vimeoProductId: number | null;
};

export type SubscriptionMutationResult = {
  subscription: Subscription;
  previousStatus: string | null;
};

export interface ISubscriptionService {
  create(input: SubscriptionLifecycleInput): Promise<SubscriptionMutationResult>;
  renew(input: SubscriptionLifecycleInput): Promise<SubscriptionMutationResult>;
  pause(input: SubscriptionLifecycleInput): Promise<SubscriptionMutationResult>;
  resume(input: SubscriptionLifecycleInput): Promise<SubscriptionMutationResult>;
  cancel(input: SubscriptionLifecycleInput): Promise<SubscriptionMutationResult>;
  expire(input: SubscriptionLifecycleInput): Promise<SubscriptionMutationResult>;
  startTrial(
    input: SubscriptionLifecycleInput,
  ): Promise<SubscriptionMutationResult>;
  convertTrial(
    input: SubscriptionLifecycleInput,
  ): Promise<SubscriptionMutationResult>;
  updateSnapshot(
    input: SubscriptionLifecycleInput,
  ): Promise<SubscriptionMutationResult>;
  markChargeFailed(
    input: SubscriptionLifecycleInput,
  ): Promise<SubscriptionMutationResult>;
  syncState(
    input: SubscriptionLifecycleInput,
    patch?: {
      status?: string | null;
      cancelledAt?: string | null;
      expiredAt?: string | null;
      pauseEndDate?: string | null;
      freeTrial?: boolean | null;
      freeTrialStart?: string | null;
      freeTrialEnd?: string | null;
      clearPause?: boolean;
    },
  ): Promise<SubscriptionMutationResult>;

  getById(id: string): Promise<Subscription>;
  list(
    filters?: SubscriptionListFilters,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<Subscription>>;
  search(
    filters: SubscriptionListFilters,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<Subscription>>;
  getStatistics(): Promise<ResourceStatistics>;
}
