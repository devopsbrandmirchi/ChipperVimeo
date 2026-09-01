import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorCard, StatusChip } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { displayName, formatDateTime } from "@/lib/utils";
import type { PaymentListItem } from "@/types/common";

function money(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const amount = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${amount} ${currency}` : `$${amount}`;
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let payment: PaymentListItem | null = null;
  let loadError: string | null = null;
  let notFound = false;

  try {
    const res = await apiGetServer<PaymentListItem>(`/payments/${id}`);
    payment = res.data;
  } catch (error) {
    notFound = error instanceof ApiClientError && error.isNotFound;
    loadError = error instanceof Error ? error.message : "Unexpected error";
  }

  if (!payment) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payment"
          breadcrumbs={[
            { label: "Payments", href: "/payments" },
            { label: "Detail" },
          ]}
        />
        <ErrorCard
          title={notFound ? "Payment not found" : "Unable to load payment"}
          message={loadError ?? "Request failed"}
        />
      </div>
    );
  }

  const title = money(payment.amount_cents, payment.currency);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={formatDateTime(payment.payment_date)}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/payments" },
          { label: payment.id.slice(0, 8) },
        ]}
        actions={<StatusChip status={payment.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Amount" value={title} />
          <Field label="Status" value={payment.status ?? "—"} />
          <Field
            label="Customer"
            value={
              <Link
                href={`/customers/${payment.customer_id}`}
                className="font-medium hover:underline"
              >
                {displayName(payment.customer_name, payment.customer_email)}
              </Link>
            }
          />
          <Field
            label="Product"
            value={
              payment.product_id ? (
                <Link
                  href={`/products/${payment.product_id}`}
                  className="hover:underline"
                >
                  {payment.product_name ?? payment.product_id}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Field
            label="Subscription"
            value={payment.subscription_id ?? "—"}
          />
          <Field
            label="Provider"
            value={payment.payment_provider ?? "—"}
          />
          <Field
            label="Transaction ref"
            value={payment.transaction_reference ?? "—"}
          />
          <Field
            label="Promotion code"
            value={payment.promotion_code ?? "—"}
          />
          <Field
            label="Failure reason"
            value={payment.failure_reason ?? "—"}
          />
          <Field label="Created" value={formatDateTime(payment.created_at)} />
          <Field label="Updated" value={formatDateTime(payment.updated_at)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/customers/${payment.customer_id}`}>View customer</Link>
        </Button>
        {payment.product_id ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/products/${payment.product_id}`}>View product</Link>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/payments?customerId=${payment.customer_id}`}>
            More from customer
          </Link>
        </Button>
      </div>

      {payment.raw_payment ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Raw payload</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-[var(--muted)] p-4 text-xs leading-relaxed">
              {JSON.stringify(payment.raw_payment, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-0.5 break-all">{value}</div>
    </div>
  );
}
