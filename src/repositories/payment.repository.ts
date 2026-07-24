import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type { Payment, PaymentInsert, PaymentUpdate } from "@/types/database";
import type { DateRangeOptions } from "@/types/repository";

const TABLE = "payments";

const SUCCESS_STATUSES = ["succeeded", "paid", "success", "completed"];
const FAILED_STATUSES = ["failed", "failure", "declined", "charge_failed"];

export class PaymentRepository extends BaseRepository<
  Payment,
  PaymentInsert,
  PaymentUpdate
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  async findByCustomer(customerId: string): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("customer_id", customerId)
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) this.throwMapped(error, "findByCustomer");
    return (data ?? []) as Payment[];
  }

  async findBySubscription(subscriptionId: string): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) this.throwMapped(error, "findBySubscription");
    return (data ?? []) as Payment[];
  }

  async findFailed(limit = 100): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .in("status", FAILED_STATUSES)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findFailed");
    return (data ?? []) as Payment[];
  }

  async findSuccessful(limit = 100): Promise<Payment[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .in("status", SUCCESS_STATUSES)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 200));

    if (error) this.throwMapped(error, "findSuccessful");
    return (data ?? []) as Payment[];
  }

  async findBetweenDates(options: DateRangeOptions): Promise<Payment[]> {
    const limit = Math.min(options.limit ?? 100, 200);
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .gte("payment_date", options.from)
      .lte("payment_date", options.to)
      .order("payment_date", { ascending: false })
      .limit(limit);

    if (error) this.throwMapped(error, "findBetweenDates");
    return (data ?? []) as Payment[];
  }
}
