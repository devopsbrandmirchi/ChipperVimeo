import { Suspense } from "react";

import { ErrorCard, LoadingTable } from "@/components/common/feedback";
import {
  PaymentFilters,
  PaymentsTable,
} from "@/components/payments/PaymentsTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { PaymentListItem } from "@/types/common";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function loadPayments(searchParams: SearchParams) {
  const sp = await searchParams;
  const page = first(sp.page) ?? "1";
  const pageSize = first(sp.pageSize) ?? "25";
  const status = first(sp.status);
  const currency = first(sp.currency);
  const from = first(sp.from);
  const to = first(sp.to);
  const customerId = first(sp.customerId);
  const productId = first(sp.productId);
  const subscriptionId = first(sp.subscriptionId);
  const sort = first(sp.sort);
  const direction = first(sp.direction);

  const result = await apiGetServer<PaymentListItem[]>("/payments", {
    page,
    pageSize,
    status,
    currency,
    from,
    to,
    customerId,
    productId,
    subscriptionId,
    sort,
    direction,
  });

  return {
    data: result.data,
    page: result.meta?.page ?? Number(page),
    totalPages: result.meta?.totalPages ?? 1,
    total: result.meta?.total ?? result.data.length,
    query: {
      status,
      currency,
      from,
      to,
      customerId,
      productId,
      subscriptionId,
      sort,
      direction,
      pageSize,
    },
  };
}

async function PaymentsResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let payload: Awaited<ReturnType<typeof loadPayments>> | null = null;
  let loadError: string | null = null;

  try {
    payload = await loadPayments(searchParams);
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load payments";
  }

  if (!payload) {
    return (
      <ErrorCard
        title="Unable to load payments"
        message={loadError ?? "Request failed"}
      />
    );
  }

  return (
    <PaymentsTable
      data={payload.data}
      page={payload.page}
      totalPages={payload.totalPages}
      total={payload.total}
      query={payload.query}
    />
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Browse and filter the normalized payments ledger."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments" },
        ]}
      />
      <Suspense fallback={null}>
        <PaymentFilters
          initial={{
            status: first(sp.status),
            currency: first(sp.currency),
            from: first(sp.from),
            to: first(sp.to),
            customerId: first(sp.customerId),
            productId: first(sp.productId),
            subscriptionId: first(sp.subscriptionId),
          }}
        />
      </Suspense>
      <Suspense fallback={<LoadingTable />}>
        <PaymentsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
