import { ValidationError } from "@/processors/types/processing-errors";
import type { HandlerContext } from "@/processors/types/event-handler.interface";
import {
  asJson,
  boolOrNull,
  priceToCents,
  stringOrNull,
  type ExtractedPayload,
} from "@/processors/helpers/payload";
import { RepositoryError } from "@/types/errors";
import type {
  Customer,
  Payment,
  Product,
  Subscription,
  SubscriptionEvent,
} from "@/types/database";
import type { VimeoCustomer, VimeoProduct } from "@/types/vimeo";

export type SubscriptionStatePatch = {
  status?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  pauseEndDate?: string | null;
  freeTrial?: boolean | null;
  freeTrialStart?: string | null;
  freeTrialEnd?: string | null;
  clearPause?: boolean;
};

function seenAt(eventCreatedAt: string | null): string {
  return eventCreatedAt ?? new Date().toISOString();
}

export async function upsertCustomerFromPayload(
  ctx: HandlerContext,
  extracted: ExtractedPayload,
  eventCreatedAt: string | null,
): Promise<Customer> {
  const c = extracted.customer;
  const now = seenAt(eventCreatedAt);
  const existing = await ctx.customerRepo.findByVimeoCustomerId(
    extracted.vimeoCustomerId,
  );

  const promo = stringOrNull(c.promotion_code);

  return ctx.customerRepo.upsertByVimeoId({
    vimeo_customer_id: extracted.vimeoCustomerId,
    email: stringOrNull(c.email),
    first_name: stringOrNull(c.first_name),
    last_name: stringOrNull(c.last_name),
    full_name: stringOrNull(c.name),
    country: stringOrNull(c.location?.country),
    region: stringOrNull(c.location?.region),
    city: stringOrNull(c.location?.city),
    platform: stringOrNull(c.platform),
    plan: stringOrNull(c.plan),
    subscription_status: stringOrNull(c.subscription_status),
    marketing_opt_in: boolOrNull(c.marketing_opt_in),
    promotion_code: promo,
    most_recent_promotion_code: promo ?? existing?.most_recent_promotion_code ?? null,
    coupon_code: stringOrNull(c.coupon_code),
    registered_to_site: boolOrNull(c.registered_to_site),
    subscribed_to_site: boolOrNull(c.subscribed_to_site),
    customer_created_at: stringOrNull(c.created_at),
    customer_updated_at: stringOrNull(c.updated_at),
    first_seen_at: existing?.first_seen_at ?? now,
    last_seen_at: now,
    last_payment_date: stringOrNull(c.last_payment_date),
    next_payment_date: stringOrNull(c.next_payment_date),
    active_subscription_id: existing?.active_subscription_id ?? null,
    raw_customer: asJson(c),
  });
}

export async function upsertProductFromPayload(
  ctx: HandlerContext,
  product: VimeoProduct | null,
  vimeoProductId: number | null,
): Promise<Product | null> {
  if (!product || vimeoProductId === null) return null;

  const purchase = product.price?.purchase;
  const rental = product.price?.rental;
  const monthlyCents =
    typeof purchase?.cents === "number" ? purchase.cents : null;
  const yearlyCents =
    typeof rental?.cents === "number" ? rental.cents : null;

  const activeRaw = product.is_active;
  const active =
    typeof activeRaw === "boolean"
      ? activeRaw
      : typeof activeRaw === "string"
        ? activeRaw.toLowerCase() === "true" || activeRaw === "1"
        : null;

  return ctx.productRepo.upsertByVimeoId({
    vimeo_product_id: vimeoProductId,
    name: stringOrNull(product.name),
    description: stringOrNull(product.description),
    currency: stringOrNull(purchase?.currency) ?? stringOrNull(rental?.currency),
    monthly_price_cents: monthlyCents,
    yearly_price_cents: yearlyCents,
    monthly_price_formatted: stringOrNull(purchase?.formatted),
    yearly_price_formatted: stringOrNull(rental?.formatted),
    active,
    product_created_at: stringOrNull(product.created_at),
    product_updated_at: stringOrNull(product.updated_at),
    raw_product: asJson(product),
  });
}

function subscriptionSnapshotFromCustomer(
  customer: VimeoCustomer,
  patch: SubscriptionStatePatch,
): {
  status: string | null;
  billing_frequency: string | null;
  price_cents: number | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  pause_end_date: string | null;
  promotion_code: string | null;
} {
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

/**
 * Find open subscription for customer+product, or create one.
 * Terminal rows are left alone; a new open row is created on re-subscribe.
 */
export async function ensureSubscription(
  ctx: HandlerContext,
  customer: Customer,
  product: Product,
  vimeoCustomer: VimeoCustomer,
  eventCreatedAt: string | null,
  patch: SubscriptionStatePatch = {},
): Promise<{ subscription: Subscription; previousStatus: string | null }> {
  const snapshot = subscriptionSnapshotFromCustomer(vimeoCustomer, patch);
  const now = seenAt(eventCreatedAt);

  const current = await ctx.subscriptionRepo.findCurrent(
    customer.id,
    product.id,
  );

  if (current) {
    const previousStatus = current.status;
    const updated = await ctx.subscriptionRepo.update(current.id, {
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

    await ctx.customerRepo.updateSubscription(customer.id, {
      active_subscription_id:
        updated.cancelled_at || updated.expired_at ? null : updated.id,
      subscription_status: updated.status,
      last_payment_date: updated.last_payment_date,
      next_payment_date: updated.next_payment_date,
      plan: stringOrNull(vimeoCustomer.plan),
      platform: stringOrNull(vimeoCustomer.platform),
      promotion_code: snapshot.promotion_code,
      most_recent_promotion_code: snapshot.promotion_code,
      coupon_code: stringOrNull(vimeoCustomer.coupon_code),
      subscribed_to_site: boolOrNull(vimeoCustomer.subscribed_to_site),
    });

    return { subscription: updated, previousStatus };
  }

  const created = await ctx.subscriptionRepo.create({
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

  await ctx.customerRepo.updateSubscription(customer.id, {
    active_subscription_id:
      created.cancelled_at || created.expired_at ? null : created.id,
    subscription_status: created.status,
    last_payment_date: created.last_payment_date,
    next_payment_date: created.next_payment_date,
    plan: stringOrNull(vimeoCustomer.plan),
    platform: stringOrNull(vimeoCustomer.platform),
    promotion_code: snapshot.promotion_code,
    most_recent_promotion_code: snapshot.promotion_code,
    coupon_code: stringOrNull(vimeoCustomer.coupon_code),
    subscribed_to_site: boolOrNull(vimeoCustomer.subscribed_to_site),
  });

  return { subscription: created, previousStatus: null };
}

export async function recordLifecycleEvent(
  ctx: HandlerContext,
  args: {
    customerId: string;
    subscriptionId: string;
    vottEventId: string;
    eventType: string;
    previousStatus: string | null;
    newStatus: string | null;
    eventCreatedAt: string | null;
    payload?: unknown;
  },
): Promise<SubscriptionEvent | null> {
  try {
    return await ctx.subscriptionEventRepo.create({
      customer_id: args.customerId,
      subscription_id: args.subscriptionId,
      vott_event_id: args.vottEventId,
      event_type: args.eventType,
      previous_status: args.previousStatus,
      new_status: args.newStatus,
      event_created_at: args.eventCreatedAt,
      payload: asJson(args.payload ?? null),
    });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "UniqueViolation") {
      return null;
    }
    throw error;
  }
}

export async function recordPayment(
  ctx: HandlerContext,
  args: {
    customerId: string;
    subscriptionId: string;
    productId: string;
    vottEventId: string;
    amountCents: number | null;
    currency: string | null;
    status: "succeeded" | "failed";
    paymentDate: string | null;
    promotionCode: string | null;
    failureReason?: string | null;
    raw?: unknown;
  },
): Promise<Payment | null> {
  const reference = `vimeo:${args.vottEventId}`;
  try {
    return await ctx.paymentRepo.create({
      customer_id: args.customerId,
      subscription_id: args.subscriptionId,
      product_id: args.productId,
      amount_cents: args.amountCents,
      currency: args.currency,
      status: args.status,
      payment_date: args.paymentDate,
      payment_provider: "vimeo",
      transaction_reference: reference,
      failure_reason: args.failureReason ?? null,
      promotion_code: args.promotionCode,
      raw_payment: asJson(args.raw ?? null),
    });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "UniqueViolation") {
      return null;
    }
    throw error;
  }
}

/** Full product-lifecycle path: customer → product → subscription → event (+ optional payment). */
export async function processProductLifecycle(
  ctx: HandlerContext,
  extracted: ExtractedPayload,
  eventCreatedAt: string | null,
  vottEventId: string,
  eventType: string,
  patch: SubscriptionStatePatch,
  payment?: {
    status: "succeeded" | "failed";
    failureReason?: string | null;
  },
): Promise<void> {
  const customer = await upsertCustomerFromPayload(
    ctx,
    extracted,
    eventCreatedAt,
  );
  const product = await upsertProductFromPayload(
    ctx,
    extracted.product,
    extracted.vimeoProductId,
  );

  if (!product) {
    throw new ValidationError(
      "Product lifecycle event requires an embedded product id",
    );
  }

  const { subscription, previousStatus } = await ensureSubscription(
    ctx,
    customer,
    product,
    extracted.customer,
    eventCreatedAt,
    patch,
  );

  // Payment before lifecycle event so a failed payment can retry before the
  // vott_event_id idempotency marker is written.
  if (payment) {
    await recordPayment(ctx, {
      customerId: customer.id,
      subscriptionId: subscription.id,
      productId: product.id,
      vottEventId,
      amountCents: priceToCents(extracted.customer.subscription_price),
      currency: product.currency,
      status: payment.status,
      paymentDate:
        stringOrNull(extracted.customer.last_payment_date) ?? eventCreatedAt,
      promotionCode: stringOrNull(extracted.customer.promotion_code),
      failureReason: payment.failureReason ?? null,
      raw: {
        subscription_price: extracted.customer.subscription_price,
        last_payment_date: extracted.customer.last_payment_date,
      },
    });
  }

  await recordLifecycleEvent(ctx, {
    customerId: customer.id,
    subscriptionId: subscription.id,
    vottEventId,
    eventType,
    previousStatus,
    newStatus: subscription.status,
    eventCreatedAt,
    payload: {
      topic_event_type: eventType,
      vimeo_customer_id: extracted.vimeoCustomerId,
      vimeo_product_id: extracted.vimeoProductId,
    },
  });
}
