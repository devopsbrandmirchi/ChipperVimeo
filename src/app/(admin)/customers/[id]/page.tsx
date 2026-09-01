import Link from "next/link";
import type { ReactNode } from "react";

import {
  CountryBadge,
  ErrorCard,
  PlatformBadge,
  StatusChip,
} from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { displayName, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Customer,
  Product,
  Subscription,
  SubscriptionEvent,
} from "@/types/database";
import type { PaymentListItem } from "@/types/common";
import type { VottEvent } from "@/types/vimeo";

type DetailData = {
  customer: Customer;
  subs: Subscription[];
  payments: PaymentListItem[];
  timeline: SubscriptionEvent[];
  webhooks: VottEvent[];
  product: Product | null;
  currentSub: Subscription | null;
};

async function loadCustomerDetail(id: string): Promise<DetailData> {
  const customerRes = await apiGetServer<Customer>(`/customers/${id}`);
  const customer = customerRes.data;

  const [subs, payments, timeline, webhooks] = await Promise.all([
    apiGetServer<Subscription[]>("/subscriptions", {
      customerId: customer.id,
      pageSize: 50,
    }),
    apiGetServer<PaymentListItem[]>("/payments", {
      customerId: customer.id,
      pageSize: 50,
    }),
    apiGetServer<SubscriptionEvent[]>(`/timeline/${customer.id}`),
    apiGetServer<VottEvent[]>("/webhook-events", {
      customerId: customer.vimeo_customer_id,
      pageSize: 25,
    }),
  ]);

  const currentSub =
    subs.data.find((s) => s.id === customer.active_subscription_id) ??
    subs.data[0] ??
    null;

  let product: Product | null = null;
  if (currentSub?.product_id) {
    try {
      const productRes = await apiGetServer<Product>(
        `/products/${currentSub.product_id}`,
      );
      product = productRes.data;
    } catch {
      product = null;
    }
  }

  return {
    customer,
    subs: subs.data,
    payments: payments.data,
    timeline: timeline.data,
    webhooks: webhooks.data,
    product,
    currentSub,
  };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: DetailData | null = null;
  let loadError: string | null = null;
  let notFound = false;

  try {
    data = await loadCustomerDetail(id);
  } catch (error) {
    notFound = error instanceof ApiClientError && error.isNotFound;
    loadError =
      error instanceof Error ? error.message : "Unexpected error";
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customer"
          breadcrumbs={[
            { label: "Customers", href: "/customers" },
            { label: "Detail" },
          ]}
        />
        <ErrorCard
          title={notFound ? "Customer not found" : "Unable to load customer"}
          message={loadError ?? "Request failed"}
        />
      </div>
    );
  }

  const { customer, subs, payments, timeline, webhooks, product, currentSub } =
    data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={displayName(customer.full_name, customer.email)}
        description={customer.email ?? undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: displayName(customer.full_name, customer.email) },
        ]}
        actions={
          <Badge variant="outline">Vimeo #{customer.vimeo_customer_id}</Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Customer information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Info
              label="Name"
              value={displayName(customer.full_name, customer.email)}
            />
            <Info label="Email" value={customer.email} />
            <Info
              label="Status"
              value={<StatusChip status={customer.subscription_status} />}
            />
            <Info label="Plan" value={customer.plan} />
            <Info
              label="Country"
              value={<CountryBadge country={customer.country} />}
            />
            <Info
              label="Platform"
              value={<PlatformBadge platform={customer.platform} />}
            />
            <Info
              label="First seen"
              value={formatDateTime(customer.first_seen_at)}
            />
            <Info
              label="Last seen"
              value={formatDateTime(customer.last_seen_at)}
            />
            <Info label="Region" value={customer.region} />
            <Info label="City" value={customer.city} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentSub ? (
              <>
                <Info
                  label="Status"
                  value={<StatusChip status={currentSub.status} />}
                />
                <Info label="Billing" value={currentSub.billing_frequency} />
                <Info
                  label="Price"
                  value={
                    currentSub.price_cents != null
                      ? `$${(currentSub.price_cents / 100).toFixed(2)}`
                      : "—"
                  }
                />
                <Info
                  label="Renewal"
                  value={formatDate(currentSub.renewal_date)}
                />
                <Info
                  label="Product"
                  value={
                    product ? (
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name ?? product.sku ?? product.id}
                      </Link>
                    ) : (
                      currentSub.product_id ?? "—"
                    )
                  }
                />
              </>
            ) : (
              <p className="text-[var(--muted-foreground)]">
                No subscription on file.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Section title="Subscription history">
        {subs.length === 0 ? (
          <Muted>No subscriptions.</Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {subs.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <StatusChip status={s.status} />
                  <span>{s.billing_frequency ?? "—"}</span>
                </div>
                <span className="text-[var(--muted-foreground)]">
                  Started {formatDate(s.started_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Timeline">
        {timeline.length === 0 ? (
          <Muted>No timeline events.</Muted>
        ) : (
          <ol className="space-y-3">
            {timeline.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {event.event_type ?? "event"}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {formatDateTime(event.event_created_at)}
                  </span>
                </div>
                {(event.previous_status || event.new_status) && (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {event.previous_status ?? "—"} → {event.new_status ?? "—"}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Payments">
        {payments.length === 0 ? (
          <Muted>No payments.</Muted>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Currency</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="py-2">{formatDate(p.payment_date)}</td>
                    <td className="py-2">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="py-2">
                      {p.amount_cents != null
                        ? `$${(p.amount_cents / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-2">{p.currency ?? "—"}</td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/payments/${p.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Webhook events">
        {webhooks.length === 0 ? (
          <Muted>No webhook events for this Vimeo customer id.</Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {webhooks.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <Link
                  href={`/webhook-events?customerId=${customer.vimeo_customer_id}`}
                  className="font-medium hover:underline"
                >
                  {e.topic ?? "unknown topic"}
                </Link>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(e.received_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--muted-foreground)]">{children}</p>;
}
