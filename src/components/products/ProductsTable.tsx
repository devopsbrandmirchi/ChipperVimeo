"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Loader2 } from "lucide-react";

import { FilterPendingBanner } from "@/components/common/FilterPendingBanner";
import { StatusChip } from "@/components/common/feedback";
import { DataTable } from "@/components/tables/DataTable";
import { PaginationLinks } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { Product } from "@/types/database";

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ProductsTable({
  data,
  page,
  totalPages,
  total,
  query,
}: {
  data: Product[];
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string | undefined>;
}) {
  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            href={`/products/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name ?? row.original.sku ?? "Untitled"}
          </Link>
        ),
      },
      {
        header: "SKU",
        accessorKey: "sku",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        header: "Status",
        accessorKey: "active",
        cell: ({ getValue }) => (
          <StatusChip status={getValue() ? "active" : "inactive"} />
        ),
      },
      {
        header: "Currency",
        accessorKey: "currency",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        header: "Monthly",
        accessorKey: "monthly_price_cents",
        cell: ({ row }) =>
          row.original.monthly_price_formatted ??
          money(row.original.monthly_price_cents),
      },
      {
        header: "Yearly",
        accessorKey: "yearly_price_cents",
        cell: ({ row }) =>
          row.original.yearly_price_formatted ??
          money(row.original.yearly_price_cents),
      },
      {
        header: "Trial",
        id: "trial",
        cell: ({ row }) =>
          row.original.free_trial_enabled
            ? `${row.original.free_trial_days ?? "?"}d`
            : "—",
      },
      {
        header: "Vimeo ID",
        accessorKey: "vimeo_product_id",
      },
      {
        header: "Updated",
        accessorKey: "updated_at",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/products/${row.original.id}`}>View</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/api/v1/products/export${qs ? `?${qs}` : ""}`;
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <a href={exportHref}>
            <Download className="size-3.5" />
            Export CSV
          </a>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        emptyTitle="No products found"
        emptyDescription="Adjust filters or wait for catalog webhooks."
      />
      <PaginationLinks
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/products"
        query={query}
      />
    </div>
  );
}

export function ProductFilters({
  initial,
}: {
  initial: {
    search?: string;
    active?: string;
    sku?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initial.search ?? "");
  const [active, setActive] = useState(initial.active ?? "");
  const [sku, setSku] = useState(initial.sku ?? "");

  function apply(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDelete("search", search);
    setOrDelete("active", active);
    setOrDelete("sku", sku);
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function reset() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <form
      onSubmit={apply}
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
      aria-busy={isPending}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name"
          disabled={isPending}
        />
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm disabled:opacity-50"
          aria-label="Active filter"
          disabled={isPending}
        >
          <option value="">Status: any</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <Input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          disabled={isPending}
        />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Catalog is synced from Vimeo webhooks (read-only). Search matches product
        name.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {isPending ? "Loading…" : "Apply filters"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reset}
          disabled={isPending}
        >
          Reset
        </Button>
        <FilterPendingBanner pending={isPending} />
      </div>
    </form>
  );
}
