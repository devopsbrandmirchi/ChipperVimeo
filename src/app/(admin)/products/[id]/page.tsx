import Link from "next/link";

import {
  ErrorCard,
  StatusChip,
} from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ProductAnalyticsResponse } from "@/modules/analytics/dto/responses";
import type { Product, Subscription } from "@/types/database";
import type { PaymentListItem } from "@/types/common";

function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function loadProductDetail(id: string) {
  const productRes = await apiGetServer<Product>(`/products/${id}`);
  const product = productRes.data;

  const [subs, payments, analytics] = await Promise.all([
    apiGetServer<Subscription[]>("/subscriptions", {
      productId: id,
      pageSize: 10,
    }),
    apiGetServer<PaymentListItem[]>("/payments", {
      productId: id,
      pageSize: 10,
    }),
    apiGetServer<ProductAnalyticsResponse>("/analytics/products").catch(
      () => null,
    ),
  ]);

  const kpi =
    analytics?.data.products.find((p) => p.productId === id) ?? null;

  return {
    product,
    subs: subs.data,
    payments: payments.data,
    kpi,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof loadProductDetail>> | null = null;
  let loadError: string | null = null;
  let notFound = false;

  try {
    data = await loadProductDetail(id);
  } catch (error) {
    notFound = error instanceof ApiClientError && error.isNotFound;
    loadError = error instanceof Error ? error.message : "Unexpected error";
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Product"
          breadcrumbs={[
            { label: "Products", href: "/products" },
            { label: "Detail" },
          ]}
        />
        <ErrorCard
          title={notFound ? "Product not found" : "Unable to load product"}
          message={loadError ?? "Request failed"}
        />
      </div>
    );
  }

  const { product, subs, payments, kpi } = data;
  const title = product.name ?? product.sku ?? product.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={product.sku ? `SKU ${product.sku}` : undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Products", href: "/products" },
          { label: title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={product.active ? "active" : "inactive"} />
            <Badge variant="outline">Vimeo #{product.vimeo_product_id}</Badge>
          </div>
        }
      />

      {kpi ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Open subscribers" value={String(kpi.openSubscribers)} />
          <Kpi label="Trials" value={String(kpi.trials)} />
          <Kpi label="Revenue" value={money(kpi.revenueCents)} />
          <Kpi label="MRR contribution" value={money(kpi.mrrContributionCents)} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Description" value={product.description ?? "—"} />
          <Field label="Currency" value={product.currency ?? "—"} />
          <Field
            label="Monthly"
            value={
              product.monthly_price_formatted ??
              money(product.monthly_price_cents)
            }
          />
          <Field
            label="Yearly"
            value={
              product.yearly_price_formatted ?? money(product.yearly_price_cents)
            }
          />
          <Field
            label="Free trial"
            value={
              product.free_trial_enabled
                ? `${product.free_trial_days ?? "?"} days`
                : "No"
            }
          />
          <Field
            label="Content"
            value={`${product.movies_count ?? 0} movies · ${product.series_count ?? 0} series · ${product.categories_count ?? 0} categories`}
          />
          <Field
            label="Product created"
            value={formatDateTime(product.product_created_at)}
          />
          <Field label="Updated" value={formatDateTime(product.updated_at)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent subscriptions</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/subscriptions?productId=${product.id}`}>
                View all
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {subs.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No subscriptions for this product.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {subs.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0"
                  >
                    <div>
                      <StatusChip status={s.status} />
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Started {formatDate(s.started_at)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/customers/${s.customer_id}`}>Customer</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent payments</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payments?productId=${product.id}`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No payments for this product.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0"
                  >
                    <div>
                      <StatusChip status={p.status} />
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDate(p.payment_date)} · {money(p.amount_cents)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/payments/${p.id}`}>View</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
