import type { Logger } from "@/processors/logger/logger";
import {
  asJson,
  boolOrNull,
  priceToCents,
  stringOrNull,
} from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import { ServiceValidationError } from "@/services/shared/errors";
import type { ICustomerService } from "@/services/interfaces/customer-service.interface";
import type {
  ISubscriptionService,
  SubscriptionLifecycleInput,
  SubscriptionMutationResult,
} from "@/services/interfaces/subscription-service.interface";
import type { ITimelineService } from "@/services/interfaces/timeline-service.interface";
import type { ISubscriptionRepository } from "@/services/interfaces/repositories";
import type { Subscription } from "@/types/database";
import type { VimeoCustomer } from "@/types/vimeo";

type StatePatch = {
  status?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  pauseEndDate?: string | null;
  freeTrial?: boolean | null;
  freeTrialStart?: string | null;
  freeTrialEnd?: string | null;
  clearPause?: boolean;
};

type TimelineWriter = (
  input: Parameters<ITimelineService["recordCreated"]>[0],
) => ReturnType<ITimelineService["recordCreated"]>;

export class SubscriptionService
  extends BaseService
  implements ISubscriptionService
{
  constructor(
    private readonly subscriptions: ISubscriptionRepository,
    private readonly customers: ICustomerService,
    private readonly timeline: ITimelineService,
    logger: Logger,
  ) {
    super("SubscriptionService", logger);
  }

  async create(input: SubscriptionLifecycleInput) {
    return this.applyLifecycle(input, {}, (i) => this.timeline.recordCreated(i));
  }

  async renew(input: SubscriptionLifecycleInput) {
    return this.applyLifecycle(
      input,
      { status: input.vimeoCustomer.subscription_status ?? "active" },
      (i) => this.timeline.recordRenewal(i),
    );
  }

  async pause(input: SubscriptionLifecycleInput) {
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "paused",
        pauseEndDate: input.vimeoCustomer.pause_end_date ?? null,
      },
      (i) => this.timeline.recordPaused(i),
    );
  }

  async resume(input: SubscriptionLifecycleInput) {
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "active",
        clearPause: true,
      },
      (i) => this.timeline.recordResumed(i),
    );
  }

  async cancel(input: SubscriptionLifecycleInput) {
    const at = this.coalesceTimestamp(input.eventCreatedAt);
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "cancelled",
        cancelledAt: at,
      },
      (i) => this.timeline.recordCancelled(i),
    );
  }

  async expire(input: SubscriptionLifecycleInput) {
    const at = this.coalesceTimestamp(input.eventCreatedAt);
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "expired",
        expiredAt: at,
      },
      (i) => this.timeline.recordExpired(i),
    );
  }

  async startTrial(input: SubscriptionLifecycleInput) {
    const start = this.coalesceTimestamp(input.eventCreatedAt);
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "free_trial",
        freeTrial: true,
        freeTrialStart: start,
      },
      (i) => this.timeline.recordTrialStarted(i),
    );
  }

  async convertTrial(input: SubscriptionLifecycleInput) {
    const end = this.coalesceTimestamp(input.eventCreatedAt);
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "active",
        freeTrial: false,
        freeTrialEnd: end,
      },
      (i) => this.timeline.recordTrialConverted(i),
    );
  }

  async updateSnapshot(input: SubscriptionLifecycleInput) {
    return this.applyLifecycle(input, {}, (i) => this.timeline.recordUpdated(i));
  }

  /**
   * Apply subscription state without writing timeline.
   * Use when the handler must record a payment before the lifecycle marker.
   */
  async syncState(
    input: SubscriptionLifecycleInput,
    patch: StatePatch = {},
  ): Promise<SubscriptionMutationResult> {
    return this.timed("syncState", async () => this.ensureOpen(input, patch));
  }

  /**
   * Charge-failed state sync (open sub kept) + timeline. Prefer syncState +
   * payments.recordFailed + timeline.recordChargeFailed when ordering matters.
   */
  async markChargeFailed(input: SubscriptionLifecycleInput) {
    return this.applyLifecycle(
      input,
      {
        status: input.vimeoCustomer.subscription_status ?? "charge_failed",
      },
      (i) => this.timeline.recordChargeFailed(i),
    );
  }

  private async applyLifecycle(
    input: SubscriptionLifecycleInput,
    patch: StatePatch,
    writeTimeline: TimelineWriter,
  ): Promise<SubscriptionMutationResult> {
    return this.timed("applyLifecycle", async () => {
      const { subscription, previousStatus } = await this.ensureOpen(
        input,
        patch,
      );

      await writeTimeline({
        customerId: input.customer.id,
        subscriptionId: subscription.id,
        vottEventId: input.vottEventId,
        previousStatus,
        newStatus: subscription.status,
        eventCreatedAt: input.eventCreatedAt,
        payload: {
          vimeo_customer_id: input.vimeoCustomerId,
          vimeo_product_id: input.vimeoProductId,
        },
      });

      return { subscription, previousStatus };
    });
  }

  /**
   * Business rule: one open subscription per customer+product.
   * Update current open row; if none, create. Terminal rows stay history.
   */
  private async ensureOpen(
    input: SubscriptionLifecycleInput,
    patch: StatePatch,
  ): Promise<SubscriptionMutationResult> {
    const { customer, product, vimeoCustomer, eventCreatedAt } = input;
    const snapshot = this.snapshotFromCustomer(vimeoCustomer, patch);
    const now = this.coalesceTimestamp(eventCreatedAt);

    try {
      const current = await this.subscriptions.findCurrent(
        customer.id,
        product.id,
      );

      let subscription: Subscription;
      let previousStatus: string | null;

      if (current) {
        previousStatus = current.status;
        subscription = await this.subscriptions.update(current.id, {
          status: snapshot.status,
          billing_frequency: snapshot.billing_frequency,
          price_cents: snapshot.price_cents,
          currency: current.currency,
          last_payment_date: snapshot.last_payment_date,
          next_payment_date: snapshot.next_payment_date,
          renewal_date: snapshot.next_payment_date,
          pause_end_date: snapshot.pause_end_date,
          cancelled_at:
            patch.cancelledAt !== undefined
              ? patch.cancelledAt
              : current.cancelled_at,
          expired_at:
            patch.expiredAt !== undefined ? patch.expiredAt : current.expired_at,
          free_trial:
            patch.freeTrial !== undefined ? patch.freeTrial : current.free_trial,
          free_trial_start:
            patch.freeTrialStart !== undefined
              ? patch.freeTrialStart
              : current.free_trial_start,
          free_trial_end:
            patch.freeTrialEnd !== undefined
              ? patch.freeTrialEnd
              : current.free_trial_end,
          promotion_code: snapshot.promotion_code,
          subscription_updated_at: now,
          raw_subscription: asJson({
            subscription_status: vimeoCustomer.subscription_status,
            subscription_frequency: vimeoCustomer.subscription_frequency,
            subscription_price: vimeoCustomer.subscription_price,
            last_payment_date: vimeoCustomer.last_payment_date,
            next_payment_date: vimeoCustomer.next_payment_date,
            pause_end_date: vimeoCustomer.pause_end_date,
          }),
        });
      } else {
        previousStatus = null;
        subscription = await this.subscriptions.create({
          customer_id: customer.id,
          product_id: product.id,
          status: snapshot.status,
          billing_frequency: snapshot.billing_frequency,
          price_cents: snapshot.price_cents,
          started_at: now,
          last_payment_date: snapshot.last_payment_date,
          next_payment_date: snapshot.next_payment_date,
          renewal_date: snapshot.next_payment_date,
          pause_end_date: snapshot.pause_end_date,
          cancelled_at: patch.cancelledAt ?? null,
          expired_at: patch.expiredAt ?? null,
          free_trial: patch.freeTrial ?? null,
          free_trial_start: patch.freeTrialStart ?? null,
          free_trial_end: patch.freeTrialEnd ?? null,
          promotion_code: snapshot.promotion_code,
          subscription_created_at: now,
          subscription_updated_at: now,
          raw_subscription: asJson({
            subscription_status: vimeoCustomer.subscription_status,
            subscription_frequency: vimeoCustomer.subscription_frequency,
            subscription_price: vimeoCustomer.subscription_price,
          }),
        });
      }

      await this.customers.updateSubscriptionSnapshot(customer.id, {
        active_subscription_id:
          subscription.cancelled_at || subscription.expired_at
            ? null
            : subscription.id,
        subscription_status: subscription.status,
        last_payment_date: subscription.last_payment_date,
        next_payment_date: subscription.next_payment_date,
        plan: stringOrNull(vimeoCustomer.plan),
        platform: stringOrNull(vimeoCustomer.platform),
        promotion_code: snapshot.promotion_code,
        most_recent_promotion_code: snapshot.promotion_code,
        coupon_code: stringOrNull(vimeoCustomer.coupon_code),
        subscribed_to_site: boolOrNull(vimeoCustomer.subscribed_to_site),
      });

      return { subscription, previousStatus };
    } catch (error) {
      if (error instanceof ServiceValidationError) throw error;
      this.mapRepositoryError(error, "ensureOpen");
    }
  }

  private snapshotFromCustomer(
    customer: VimeoCustomer,
    patch: StatePatch,
  ) {
    return {
      status: patch.status ?? stringOrNull(customer.subscription_status),
      billing_frequency: stringOrNull(customer.subscription_frequency),
      price_cents: priceToCents(customer.subscription_price),
      last_payment_date: stringOrNull(customer.last_payment_date),
      next_payment_date: stringOrNull(customer.next_payment_date),
      pause_end_date: patch.clearPause
        ? null
        : (patch.pauseEndDate ?? stringOrNull(customer.pause_end_date)),
      promotion_code: stringOrNull(customer.promotion_code),
    };
  }
}
