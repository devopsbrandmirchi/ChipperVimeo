import { Suspense } from "react";

import { ErrorCard, LoadingTable } from "@/components/common/feedback";
import {
  ProductFilters,
  ProductsTable,
} from "@/components/products/ProductsTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { Product } from "@/types/database";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function loadProducts(searchParams: SearchParams) {
  const sp = await searchParams;
  const page = first(sp.page) ?? "1";
  const pageSize = first(sp.pageSize) ?? "25";
  const search = first(sp.search);
  const active = first(sp.active);
  const sku = first(sp.sku);
  const sort = first(sp.sort);
  const direction = first(sp.direction);

  const result = await apiGetServer<Product[]>("/products", {
    page,
    pageSize,
    search,
    active,
    sku,
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
      active,
      sku,
      sort,
      direction,
      pageSize,
    },
  };
}

async function ProductsResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let payload: Awaited<ReturnType<typeof loadProducts>> | null = null;
  let loadError: string | null = null;

  try {
    payload = await loadProducts(searchParams);
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load products";
  }

  if (!payload) {
    return (
      <ErrorCard
        title="Unable to load products"
        message={loadError ?? "Request failed"}
      />
    );
  }

  return (
    <ProductsTable
      data={payload.data}
      page={payload.page}
      totalPages={payload.totalPages}
      total={payload.total}
      query={payload.query}
    />
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Browse the Vimeo-synced product catalog."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Products" },
        ]}
      />
      <Suspense fallback={null}>
        <ProductFilters
          initial={{
            search: first(sp.search),
            active: first(sp.active),
            sku: first(sp.sku),
          }}
        />
      </Suspense>
      <Suspense fallback={<LoadingTable />}>
        <ProductsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
