import type {
  Customer,
  CustomerSubscriptionPatch,
  CustomerUpdate,
} from "@/types/database";
import type { VimeoCustomer } from "@/types/vimeo";
import type { CustomerListFilters, ResourceStatistics } from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";

export interface ICustomerService {
  upsertFromVimeoCustomer(
    vimeoCustomer: VimeoCustomer,
    vimeoCustomerId: number,
    eventCreatedAt: string | null,
  ): Promise<Customer>;
  updateProfile(id: string, patch: CustomerUpdate): Promise<Customer>;
  updateLocation(
    id: string,
    location: {
      country?: string | null;
      region?: string | null;
      city?: string | null;
    },
  ): Promise<Customer>;
  updateMarketing(
    id: string,
    patch: {
      marketing_opt_in?: boolean | null;
      registered_to_site?: boolean | null;
      subscribed_to_site?: boolean | null;
    },
  ): Promise<Customer>;
  updatePromotion(
    id: string,
    patch: {
      promotion_code?: string | null;
      most_recent_promotion_code?: string | null;
      coupon_code?: string | null;
    },
  ): Promise<Customer>;
  updateSubscriptionSnapshot(
    id: string,
    patch: CustomerSubscriptionPatch,
  ): Promise<Customer>;
  updatePaymentDates(
    id: string,
    lastPaymentDate: string | null,
    nextPaymentDate: string | null,
  ): Promise<Customer>;
  touchLastSeen(id: string, at?: string): Promise<Customer>;

  getById(id: string): Promise<Customer>;
  list(
    filters?: CustomerListFilters,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<Customer>>;
  search(
    filters: CustomerListFilters,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<Customer>>;
  getStatistics(): Promise<ResourceStatistics>;
}
