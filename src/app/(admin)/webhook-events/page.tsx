import { Suspense } from "react";

import { ErrorCard, LoadingTable } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  WebhookEventFilters,
  WebhookEventsTable,
} from "@/components/webhooks/WebhookEventsTable";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { VottEvent } from "@/types/vimeo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function loadWebhookEvents(searchParams: SearchParams) {
  const sp = await searchParams;
  const page = first(sp.page) ?? "1";
  const pageSize = first(sp.pageSize) ?? "25";
  const topic = first(sp.topic);
  const email = first(sp.email);
  const customerId = first(sp.customerId);
  const from = first(sp.from);
  const to = first(sp.to);
  const sort = first(sp.sort);
  const direction = first(sp.direction);

  const result = await apiGetServer<VottEvent[]>("/webhook-events", {
    page,
    pageSize,
    topic,
    email,
    customerId,
    from,
    to,
    sort,
    direction,
  });

  return {
    data: result.data,
    page: result.meta?.page ?? Number(page),
    totalPages: result.meta?.totalPages ?? 1,
    total: result.meta?.total ?? result.data.length,
    query: {
      topic,
      email,
      customerId,
      from,
      to,
      sort,
      direction,
      pageSize,
    },
  };
}

async function WebhookResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let payload: Awaited<ReturnType<typeof loadWebhookEvents>> | null = null;
  let loadError: string | null = null;

  try {
    payload = await loadWebhookEvents(searchParams);
  } catch (error) {
    loadError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Request failed";
  }

  if (!payload) {
    return (
      <ErrorCard
        title="Unable to load webhook events"
        message={loadError ?? "Request failed"}
      />
    );
  }

  return (
    <WebhookEventsTable
      data={payload.data}
      page={payload.page}
      totalPages={payload.totalPages}
      total={payload.total}
      query={payload.query}
    />
  );
}

export default async function WebhookEventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook events"
        description="Immutable ingest log from Vimeo OTT deliveries."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Webhook Events" },
        ]}
      />
      <Suspense fallback={null}>
        <WebhookEventFilters
          initial={{
            topic: first(sp.topic),
            email: first(sp.email),
            customerId: first(sp.customerId),
            from: first(sp.from),
            to: first(sp.to),
          }}
        />
      </Suspense>
      <Suspense fallback={<LoadingTable />}>
        <WebhookResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
