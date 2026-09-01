"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { StatusChip } from "@/components/common/feedback";
import { DataTable } from "@/components/tables/DataTable";
import { PaginationLinks } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { Subscription } from "@/types/database";

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function SubscriptionsTable({
  data,
  page,
  totalPages,
  total,
  query,
}: {
  data: Subscription[];
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string | undefined>;
}) {
  const columns = useMemo<ColumnDef<Subscription>[]>(
    () => [
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ getValue }) => (
          <StatusChip status={getValue() as string | null} />
        ),
      },
      {
        header: "Billing",
        accessorKey: "billing_frequency",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        header: "Trial",
        accessorKey: "free_trial",
        cell: ({ getValue }) => ((getValue() as boolean | null) ? "Yes" : "No"),
      },
      {
        header: "Price",
        accessorKey: "price_cents",
        cell: ({ row }) => (
          <span>
            {money(row.original.price_cents)}
            {row.original.currency ? (
              <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                {row.original.currency}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        header: "Started",
        accessorKey: "started_at",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Renewal",
        accessorKey: "renewal_date",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Cancelled",
        accessorKey: "cancelled_at",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Customer",
        accessorKey: "customer_id",
        cell: ({ getValue }) => {
          const id = getValue() as string;
          return (
            <Link
              href={`/customers/${id}`}
              className="font-medium hover:underline"
            >
              {shortId(id)}…
            </Link>
          );
        },
      },
      {
        header: "Product",
        accessorKey: "product_id",
        cell: ({ getValue }) => (
          <span className="text-[var(--muted-foreground)]">
            {shortId(getValue() as string)}…
          </span>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/customers/${row.original.customer_id}`}>
              View customer
            </Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data}
        emptyTitle="No subscriptions found"
        emptyDescription="Adjust filters or ingest more webhook events."
      />
      <PaginationLinks
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/subscriptions"
        query={query}
      />
    </div>
  );
}

export function SubscriptionFilters({
  initial,
}: {
  initial: {
    status?: string;
    billingFrequency?: string;
    trial?: string;
    renewalFrom?: string;
    renewalTo?: string;
    customerId?: string;
    productId?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(initial.status ?? "");
  const [billingFrequency, setBillingFrequency] = useState(
    initial.billingFrequency ?? "",
  );
  const [trial, setTrial] = useState(initial.trial ?? "");
  const [renewalFrom, setRenewalFrom] = useState(initial.renewalFrom ?? "");
  const [renewalTo, setRenewalTo] = useState(initial.renewalTo ?? "");
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [productId, setProductId] = useState(initial.productId ?? "");

  function apply(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDelete("status", status);
    setOrDelete("billingFrequency", billingFrequency);
    setOrDelete("trial", trial);
    setOrDelete("renewalFrom", renewalFrom);
    setOrDelete("renewalTo", renewalTo);
    setOrDelete("customerId", customerId);
    setOrDelete("productId", productId);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function reset() {
    router.push(pathname);
  }

  return (
    <form
      onSubmit={apply}
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Input
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status e.g. Enabled"
        />
        <Input
          value={billingFrequency}
          onChange={(e) => setBillingFrequency(e.target.value)}
          placeholder="Billing e.g. monthly"
        />
        <select
          value={trial}
          onChange={(e) => setTrial(e.target.value)}
          className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
          aria-label="Trial filter"
        >
          <option value="">Trial: any</option>
          <option value="true">Trial only</option>
          <option value="false">Non-trial</option>
        </select>
        <Input
          type="date"
          value={renewalFrom}
          onChange={(e) => setRenewalFrom(e.target.value)}
          aria-label="Renewal from"
          title="Renewal from"
        />
        <Input
          type="date"
          value={renewalTo}
          onChange={(e) => setRenewalTo(e.target.value)}
          aria-label="Renewal to"
          title="Renewal to"
        />
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Customer UUID"
        />
        <Input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Product UUID"
        />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Status and billing are case-insensitive partial matches. Date fields
        filter by renewal date (UTC). Open a row via customer for full detail.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
