"use client";

import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { StatusChip } from "@/components/common/feedback";
import { DataTable } from "@/components/tables/DataTable";
import { PaginationLinks } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import type { VottEvent } from "@/types/vimeo";

export function RawPayloadDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: VottEvent | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Raw payload{event?.topic ? ` — ${event.topic}` : ""}
          </DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-[var(--muted)] p-4 text-xs leading-relaxed">
          {event
            ? JSON.stringify(event.payload, null, 2)
            : "No payload"}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

export function WebhookEventsTable({
  data,
  page,
  totalPages,
  total,
  query,
}: {
  data: VottEvent[];
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string | undefined>;
}) {
  const [selected, setSelected] = useState<VottEvent | null>(null);

  const columns = useMemo<ColumnDef<VottEvent>[]>(
    () => [
      {
        header: "Topic",
        accessorKey: "topic",
        cell: ({ getValue }) => (
          <span className="font-medium">{(getValue() as string | null) ?? "—"}</span>
        ),
      },
      {
        header: "Customer",
        accessorKey: "customer_email",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.customer_email ?? "—"}</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {row.original.customer_id != null
                ? `#${row.original.customer_id}`
                : ""}
            </span>
          </div>
        ),
      },
      {
        header: "Product",
        accessorKey: "product_name",
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
        header: "Received",
        accessorKey: "received_at",
        cell: ({ getValue }) => formatDateTime(getValue() as string),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(row.original)}
          >
            View JSON
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
        emptyTitle="No webhook events"
        emptyDescription="Events appear here after Vimeo deliveries are ingested."
      />
      <PaginationLinks
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/webhook-events"
        query={query}
      />
      <RawPayloadDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        event={selected}
      />
    </div>
  );
}

export function WebhookEventFilters({
  initial,
}: {
  initial: {
    topic?: string;
    email?: string;
    customerId?: string;
    from?: string;
    to?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(initial.topic ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");

  function apply(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDelete("topic", topic);
    setOrDelete("email", email);
    setOrDelete("customerId", customerId);
    setOrDelete("from", from);
    setOrDelete("to", to);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={apply}
      className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:grid-cols-5"
    >
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic"
      />
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Customer email"
      />
      <Input
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        placeholder="Vimeo customer id"
      />
      <Input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        aria-label="From date"
      />
      <Input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        aria-label="To date"
      />
      <div className="flex gap-2 md:col-span-5">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push(pathname)}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
