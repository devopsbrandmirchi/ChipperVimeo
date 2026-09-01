"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Loader2 } from "lucide-react";

import { useAuth } from "@/auth/hooks/useAuth";
import { FilterPendingBanner } from "@/components/common/FilterPendingBanner";
import { StatusChip } from "@/components/common/feedback";
import { DataTable } from "@/components/tables/DataTable";
import { PaginationLinks } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName, formatDate } from "@/lib/utils";
import type { PaymentListItem } from "@/types/common";

function money(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const amount = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${amount} ${currency}` : `$${amount}`;
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return `${id.slice(0, 8)}…`;
}

export function PaymentsTable({
  data,
  page,
  totalPages,
  total,
  query,
}: {
  data: PaymentListItem[];
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string | undefined>;
}) {
  const { hasPermission } = useAuth();
  const canExport = hasPermission("payments:export");

  const columns = useMemo<ColumnDef<PaymentListItem>[]>(
    () => [
      {
        header: "Date",
        accessorKey: "payment_date",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ getValue }) => (
          <StatusChip status={getValue() as string | null} />
        ),
      },
      {
        header: "Amount",
        accessorKey: "amount_cents",
        cell: ({ row }) =>
          money(row.original.amount_cents, row.original.currency),
      },
      {
        header: "Customer",
        id: "customer",
        cell: ({ row }) => (
          <Link
            href={`/customers/${row.original.customer_id}`}
            className="font-medium hover:underline"
          >
            {displayName(row.original.customer_name, row.original.customer_email)}
          </Link>
        ),
      },
      {
        header: "Product",
        id: "product",
        cell: ({ row }) =>
          row.original.product_id ? (
            <Link
              href={`/products/${row.original.product_id}`}
              className="hover:underline"
            >
              {row.original.product_name ?? shortId(row.original.product_id)}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        header: "Subscription",
        accessorKey: "subscription_id",
        cell: ({ getValue }) => shortId(getValue() as string | null),
      },
      {
        header: "Provider",
        accessorKey: "payment_provider",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        header: "Failure",
        accessorKey: "failure_reason",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return "—";
          return v.length > 40 ? `${v.slice(0, 40)}…` : v;
        },
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/payments/${row.original.id}`}>View</Link>
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
    return `/api/v1/payments/export${qs ? `?${qs}` : ""}`;
  }, [query]);

  return (
    <div className="space-y-4">
      {canExport ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download className="size-3.5" />
              Export CSV
            </a>
          </Button>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={data}
        emptyTitle="No payments found"
        emptyDescription="Adjust filters or wait for payment webhooks."
      />
      <PaginationLinks
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/payments"
        query={query}
      />
    </div>
  );
}

export function PaymentFilters({
  initial,
}: {
  initial: {
    status?: string;
    currency?: string;
    from?: string;
    to?: string;
    customerId?: string;
    productId?: string;
    subscriptionId?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initial.status ?? "");
  const [currency, setCurrency] = useState(initial.currency ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [productId, setProductId] = useState(initial.productId ?? "");
  const [subscriptionId, setSubscriptionId] = useState(
    initial.subscriptionId ?? "",
  );

  function apply(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDelete("status", status);
    setOrDelete("currency", currency);
    setOrDelete("from", from);
    setOrDelete("to", to);
    setOrDelete("customerId", customerId);
    setOrDelete("productId", productId);
    setOrDelete("subscriptionId", subscriptionId);
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
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Input
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status e.g. succeeded"
          disabled={isPending}
        />
        <Input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder="Currency e.g. USD"
          disabled={isPending}
        />
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="From date"
          title="From"
          disabled={isPending}
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="To date"
          title="To"
          disabled={isPending}
        />
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Customer UUID"
          disabled={isPending}
        />
        <Input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Product UUID"
          disabled={isPending}
        />
        <Input
          value={subscriptionId}
          onChange={(e) => setSubscriptionId(e.target.value)}
          placeholder="Subscription UUID"
          disabled={isPending}
        />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Date range filters by payment_date (UTC). Deep-link filters from customer
        or product detail pages are supported.
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
