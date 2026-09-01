import { Suspense } from "react";

import { ErrorCard, LoadingTable } from "@/components/common/feedback";
import {
  SubscriptionFilters,
  SubscriptionsTable,
} from "@/components/subscriptions/SubscriptionsTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { Subscription } from "@/types/database";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function loadSubscriptions(searchParams: SearchParams) {
  const sp = await searchParams;
  const page = first(sp.page) ?? "1";
  const pageSize = first(sp.pageSize) ?? "25";
  const status = first(sp.status);
  const billingFrequency = first(sp.billingFrequency);
  const trial = first(sp.trial);
  const renewalFrom = first(sp.renewalFrom);
  const renewalTo = first(sp.renewalTo);
  const customerId = first(sp.customerId);
  const productId = first(sp.productId);
  const sort = first(sp.sort);
  const direction = first(sp.direction);

  const result = await apiGetServer<Subscription[]>("/subscriptions", {
    page,
    pageSize,
    status,
    billingFrequency,
    trial,
    renewalFrom,
    renewalTo,
    customerId,
    productId,
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
      billingFrequency,
      trial,
      renewalFrom,
      renewalTo,
      customerId,
      productId,
      sort,
      direction,
      pageSize,
    },
  };
}

async function SubscriptionsResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let payload: Awaited<ReturnType<typeof loadSubscriptions>> | null = null;
  let loadError: string | null = null;

  try {
    payload = await loadSubscriptions(searchParams);
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load subscriptions";
  }

  if (!payload) {
    return (
      <ErrorCard
        title="Unable to load subscriptions"
        message={loadError ?? "Request failed"}
      />
    );
  }

  return (
    <SubscriptionsTable
      data={payload.data}
      page={payload.page}
      totalPages={payload.totalPages}
      total={payload.total}
      query={payload.query}
    />
  );
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Browse and filter subscriptions from the normalized store."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Subscriptions" },
        ]}
      />
      <Suspense fallback={null}>
        <SubscriptionFilters
          initial={{
            status: first(sp.status),
            billingFrequency: first(sp.billingFrequency),
            trial: first(sp.trial),
            renewalFrom: first(sp.renewalFrom),
            renewalTo: first(sp.renewalTo),
            customerId: first(sp.customerId),
            productId: first(sp.productId),
          }}
        />
      </Suspense>
      <Suspense fallback={<LoadingTable />}>
        <SubscriptionsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
