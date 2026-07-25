import { Suspense } from "react";

import { ErrorCard, LoadingTable } from "@/components/common/feedback";
import {
  CustomerFilters,
  CustomersTable,
} from "@/components/customers/CustomersTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { Customer } from "@/types/database";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function loadCustomers(searchParams: SearchParams) {
  const sp = await searchParams;
  const page = first(sp.page) ?? "1";
  const pageSize = first(sp.pageSize) ?? "25";
  const search = first(sp.search);
  const status = first(sp.status);
  const subscriptionStatus = first(sp.subscriptionStatus);
  const country = first(sp.country);
  const platform = first(sp.platform);
  const plan = first(sp.plan);
  const sort = first(sp.sort);
  const direction = first(sp.direction);

  const result = await apiGetServer<Customer[]>("/customers", {
    page,
    pageSize,
    search,
    status,
    subscriptionStatus,
    country,
    platform,
    plan,
    sort,
    direction,
  });

  return {
    data: result.data,
    page: result.meta?.page ?? Number(page),
    totalPages: result.meta?.totalPages ?? 1,
    total: result.meta?.total ?? result.data.length,
    query: {
      search,
      status,
      subscriptionStatus,
      country,
      platform,
      plan,
      sort,
      direction,
      pageSize,
    },
  };
}

async function CustomersResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let payload: Awaited<ReturnType<typeof loadCustomers>> | null = null;
  let loadError: string | null = null;

  try {
    payload = await loadCustomers(searchParams);
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load customers";
  }

  if (!payload) {
    return (
      <ErrorCard title="Unable to load customers" message={loadError ?? "Request failed"} />
    );
  }

  return (
    <CustomersTable
      data={payload.data}
      page={payload.page}
      totalPages={payload.totalPages}
      total={payload.total}
      query={payload.query}
    />
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Browse and filter Vimeo OTT customers from the normalized store."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Customers" },
        ]}
      />
      <Suspense fallback={null}>
        <CustomerFilters
          initial={{
            search: first(sp.search),
            status: first(sp.status),
            subscriptionStatus: first(sp.subscriptionStatus),
            country: first(sp.country),
            platform: first(sp.platform),
            plan: first(sp.plan),
          }}
        />
      </Suspense>
      <Suspense fallback={<LoadingTable />}>
        <CustomersResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
