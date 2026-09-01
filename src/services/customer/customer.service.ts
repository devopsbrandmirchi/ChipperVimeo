import type { Logger } from "@/processors/logger/logger";
import {
  asJson,
  boolOrNull,
  stringOrNull,
} from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import type { ICustomerService } from "@/services/interfaces/customer-service.interface";
import type { ICustomerRepository } from "@/services/interfaces/repositories";
import type {
  Customer,
  CustomerSubscriptionPatch,
  CustomerUpdate,
} from "@/types/database";
import type { VimeoCustomer } from "@/types/vimeo";
import type { CustomerListFilters, ResourceStatistics } from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";
import { toPaginateOptions } from "@/types/pagination";

export class CustomerService extends BaseService implements ICustomerService {
  constructor(
    private readonly customers: ICustomerRepository,
    logger: Logger,
  ) {
    super("CustomerService", logger);
  }

  async upsertFromVimeoCustomer(
    vimeoCustomer: VimeoCustomer,
    vimeoCustomerId: number,
    eventCreatedAt: string | null,
  ): Promise<Customer> {
    return this.timed("upsertFromVimeoCustomer", async () => {
      try {
        const now = this.coalesceTimestamp(eventCreatedAt);
        const existing =
          await this.customers.findByVimeoCustomerId(vimeoCustomerId);
        const promo = stringOrNull(vimeoCustomer.promotion_code);

        return await this.customers.upsertByVimeoId({
          vimeo_customer_id: vimeoCustomerId,
          email: stringOrNull(vimeoCustomer.email),
          first_name: stringOrNull(vimeoCustomer.first_name),
          last_name: stringOrNull(vimeoCustomer.last_name),
          full_name: stringOrNull(vimeoCustomer.name),
          country: stringOrNull(vimeoCustomer.location?.country),
          region: stringOrNull(vimeoCustomer.location?.region),
          city: stringOrNull(vimeoCustomer.location?.city),
          platform: stringOrNull(vimeoCustomer.platform),
          plan: stringOrNull(vimeoCustomer.plan),
          subscription_status: stringOrNull(vimeoCustomer.subscription_status),
          marketing_opt_in: boolOrNull(vimeoCustomer.marketing_opt_in),
          promotion_code: promo,
          most_recent_promotion_code:
            promo ?? existing?.most_recent_promotion_code ?? null,
          coupon_code: stringOrNull(vimeoCustomer.coupon_code),
          registered_to_site: boolOrNull(vimeoCustomer.registered_to_site),
          subscribed_to_site: boolOrNull(vimeoCustomer.subscribed_to_site),
          customer_created_at: stringOrNull(vimeoCustomer.created_at),
          customer_updated_at: stringOrNull(vimeoCustomer.updated_at),
          first_seen_at: existing?.first_seen_at ?? now,
          last_seen_at: now,
          last_payment_date: stringOrNull(vimeoCustomer.last_payment_date),
          next_payment_date: stringOrNull(vimeoCustomer.next_payment_date),
          active_subscription_id: existing?.active_subscription_id ?? null,
          raw_customer: asJson(vimeoCustomer),
        });
      } catch (error) {
        this.mapRepositoryError(error, "upsertFromVimeoCustomer");
      }
    });
  }

  async updateProfile(id: string, patch: CustomerUpdate): Promise<Customer> {
    return this.timed("updateProfile", async () => {
      try {
        return await this.customers.update(id, patch);
      } catch (error) {
        this.mapRepositoryError(error, "updateProfile");
      }
    });
  }

  async updateLocation(
    id: string,
    location: {
      country?: string | null;
      region?: string | null;
      city?: string | null;
    },
  ): Promise<Customer> {
    return this.updateProfile(id, location);
  }

  async updateMarketing(
    id: string,
    patch: {
      marketing_opt_in?: boolean | null;
      registered_to_site?: boolean | null;
      subscribed_to_site?: boolean | null;
    },
  ): Promise<Customer> {
    return this.updateProfile(id, patch);
  }

  async updatePromotion(
    id: string,
    patch: {
      promotion_code?: string | null;
      most_recent_promotion_code?: string | null;
      coupon_code?: string | null;
    },
  ): Promise<Customer> {
    return this.updateProfile(id, patch);
  }

  async updateSubscriptionSnapshot(
    id: string,
    patch: CustomerSubscriptionPatch,
  ): Promise<Customer> {
    return this.timed("updateSubscriptionSnapshot", async () => {
      try {
        return await this.customers.updateSubscription(id, patch);
      } catch (error) {
        this.mapRepositoryError(error, "updateSubscriptionSnapshot");
      }
    });
  }

  async updatePaymentDates(
    id: string,
    lastPaymentDate: string | null,
    nextPaymentDate: string | null,
  ): Promise<Customer> {
    return this.updateSubscriptionSnapshot(id, {
      last_payment_date: lastPaymentDate,
      next_payment_date: nextPaymentDate,
    });
  }

  async touchLastSeen(id: string, at?: string): Promise<Customer> {
    return this.timed("touchLastSeen", async () => {
      try {
        return await this.customers.updateLastSeen(id, at);
      } catch (error) {
        this.mapRepositoryError(error, "touchLastSeen");
      }
    });
  }

  async getById(id: string): Promise<Customer> {
    return this.timed("getById", async () => {
      try {
        const row = await this.customers.findById(id);
        return this.requireFound(row, "customer", id);
      } catch (error) {
        this.mapRepositoryError(error, "getById");
      }
    });
  }

  async list(
    filters: CustomerListFilters = {},
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<Customer>> {
    return this.timed("list", async () => {
      try {
        // Signup/product filters still use the limited in-memory path.
        if (filters.signupFrom || filters.signupTo || filters.productId) {
          return this.search(filters, page);
        }

        const status =
          filters.subscriptionStatus ?? filters.status ?? undefined;
        const pageOpts = toPaginateOptions(page, "created_at");

        return await this.customers.paginateFiltered({
          search: filters.search,
          country: filters.country,
          platform: filters.platform,
          plan: filters.plan,
          status,
          ...pageOpts,
        });
      } catch (error) {
        this.mapRepositoryError(error, "list");
      }
    });
  }

  async search(
    filters: CustomerListFilters,
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<Customer>> {
    return this.timed("search", async () => {
      try {
        const status =
          filters.subscriptionStatus ?? filters.status ?? undefined;
        const candidates = await this.customers.search({
          email: filters.search,
          name: filters.search,
          country: filters.country,
          platform: filters.platform,
          status,
          limit: 200,
        });

        let filtered = candidates;
        if (filters.plan) {
          filtered = filtered.filter((c) => c.plan === filters.plan);
        }
        if (filters.signupFrom) {
          filtered = filtered.filter(
            (c) =>
              c.customer_created_at &&
              c.customer_created_at.slice(0, 10) >= filters.signupFrom!,
          );
        }
        if (filters.signupTo) {
          filtered = filtered.filter(
            (c) =>
              c.customer_created_at &&
              c.customer_created_at.slice(0, 10) <= filters.signupTo!,
          );
        }
        // productId cannot be joined without repo changes — ignored with note in docs

        return this.paginateCandidates(filtered, page);
      } catch (error) {
        this.mapRepositoryError(error, "search");
      }
    });
  }

  async getStatistics(): Promise<ResourceStatistics> {
    return this.timed("getStatistics", async () => {
      try {
        const total = await this.customers.count();
        const active = await this.customers.count({
          subscription_status: "active",
        });
        return {
          total,
          byStatus: { active },
          note: "Partial status breakdown — extend in analytics phase",
        };
      } catch (error) {
        this.mapRepositoryError(error, "getStatistics");
      }
    });
  }
}
