import Link from "next/link";

import { MetricCard, StatCard } from "@/components/cards/MetricCard";
import type {
  CustomerAnalyticsResponse,
  LTVResponse,
} from "@/modules/analytics/dto/responses";

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CustomerAnalyticsPanel({
  customers,
  ltv,
}: {
  customers: CustomerAnalyticsResponse;
  ltv: LTVResponse | null;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Customer analytics
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Current stock + LTV from analytics MVs (
          {customers.refreshedAt
            ? `refreshed ${customers.refreshedAt}`
            : "refresh time unknown"}
          ).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Paying customers (LTV)"
          value={ltv?.payingCustomers ?? 0}
          hint="Current · customers with lifetime revenue"
        />
        <MetricCard
          title="Avg LTV"
          value={money(ltv?.avgLtvCents ?? 0)}
          hint="Current · average lifetime revenue"
        />
        <MetricCard
          title="Median LTV"
          value={money(ltv?.medianLtvCents ?? 0)}
          hint="Current · median lifetime revenue"
        />
        <MetricCard
          title="Max LTV"
          value={money(ltv?.maxLtvCents ?? 0)}
          hint="Current · highest lifetime revenue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatCard title="Top LTV customers">
          <ul className="divide-y divide-[var(--border)] text-sm">
            {customers.topLtv.slice(0, 8).map((c) => (
              <li
                key={c.customerId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <Link
                  href={`/customers/${c.customerId}`}
                  className="truncate text-[var(--foreground)] underline-offset-2 hover:underline"
                >
                  {c.email ?? c.customerId.slice(0, 8)}
                </Link>
                <span className="shrink-0 tabular-nums">
                  {money(c.lifetimeRevenueCents)}
                </span>
              </li>
            ))}
            {customers.topLtv.length === 0 ? (
              <li className="py-4 text-[var(--muted-foreground)]">
                No LTV rows yet.
              </li>
            ) : null}
          </ul>
        </StatCard>

        <StatCard title="Recent failed payments">
          <ul className="divide-y divide-[var(--border)] text-sm">
            {customers.failedPayments.slice(0, 8).map((c) => (
              <li
                key={c.customerId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <Link
                  href={`/customers/${c.customerId}`}
                  className="truncate underline-offset-2 hover:underline"
                >
                  {c.email ?? c.customerId.slice(0, 8)}
                </Link>
                <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                  {c.failedPaymentCount} fails
                </span>
              </li>
            ))}
            {customers.failedPayments.length === 0 ? (
              <li className="py-4 text-[var(--muted-foreground)]">
                No failed-payment customers in snapshot.
              </li>
            ) : null}
          </ul>
        </StatCard>
      </div>
    </section>
  );
}
