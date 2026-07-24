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
}
