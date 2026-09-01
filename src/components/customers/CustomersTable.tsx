"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  CountryBadge,
  PlatformBadge,
  StatusChip,
} from "@/components/common/feedback";
import { DataTable } from "@/components/tables/DataTable";
import { PaginationLinks } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName, formatDate } from "@/lib/utils";
import type { Customer } from "@/types/database";

export function CustomersTable({
  data,
  page,
  totalPages,
  total,
  query,
}: {
  data: Customer[];
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string | undefined>;
}) {
  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        header: "Customer",
        accessorKey: "full_name",
        cell: ({ row }) => (
          <Link
            href={`/customers/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {displayName(row.original.full_name, row.original.email)}
          </Link>
        ),
      },
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ getValue }) => (
          <span className="text-[var(--muted-foreground)]">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        header: "Country",
        accessorKey: "country",
        cell: ({ getValue }) => (
          <CountryBadge country={getValue() as string | null} />
        ),
      },
      {
        header: "Platform",
        accessorKey: "platform",
        cell: ({ getValue }) => (
          <PlatformBadge platform={getValue() as string | null} />
        ),
      },
      {
        header: "Plan",
        accessorKey: "plan",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        header: "Status",
        accessorKey: "subscription_status",
        cell: ({ getValue }) => (
          <StatusChip status={getValue() as string | null} />
        ),
      },
      {
        header: "First seen",
        accessorKey: "first_seen_at",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Last seen",
        accessorKey: "last_seen_at",
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/customers/${row.original.id}`}>View</Link>
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
        emptyTitle="No customers found"
        emptyDescription="Ingest webhooks or adjust filters to see customers."
      />
      <PaginationLinks
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/customers"
        query={query}
      />
    </div>
  );
}

export function CustomerFilters({
  initial,
}: {
  initial: {
    search?: string;
    status?: string;
    country?: string;
    platform?: string;
    plan?: string;
    subscriptionStatus?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initial.search ?? "");
  const [status, setStatus] = useState(
    initial.subscriptionStatus ?? initial.status ?? "",
  );
  const [country, setCountry] = useState(initial.country ?? "");
  const [platform, setPlatform] = useState(initial.platform ?? "");
  const [plan, setPlan] = useState(initial.plan ?? "");

  function apply(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDelete("search", search);
    setOrDelete("subscriptionStatus", status);
    setOrDelete("country", country);
    setOrDelete("platform", platform);
    setOrDelete("plan", plan);
    params.delete("status");
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
      <div className="grid gap-3 md:grid-cols-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="md:col-span-2"
        />
        <Input
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status e.g. Enabled"
        />
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country e.g. France"
        />
        <Input
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="Platform e.g. Web"
        />
        <Input
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="Plan e.g. standard"
        />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Filters are case-insensitive and match partial text. Examples:{" "}
        <code>Enabled</code>, <code>Free_trial</code>, <code>Android_tv</code>.
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
