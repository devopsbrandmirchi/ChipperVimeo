import Link from "next/link";

import { ErrorCard, ModulePlaceholder, StatusChip } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { formatDate } from "@/lib/utils";
import type { Subscription } from "@/types/database";

export default async function SubscriptionsPage() {
  let preview: Subscription[] = [];
  let total = 0;
  let errorMessage: string | null = null;

  try {
    const result = await apiGetServer<Subscription[]>("/subscriptions", {
      page: 1,
      pageSize: 5,
    });
    preview = result.data;
    total = result.meta?.total ?? result.data.length;
  } catch (error) {
    errorMessage =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Subscription management UI expands in a later phase."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Subscriptions" },
        ]}
      />
      <ModulePlaceholder
        title="Layout ready"
        description={`Connected to GET /api/v1/subscriptions. Showing a live preview of ${total} total subscription(s). Full filters and detail views ship later.`}
      >
        {errorMessage ? (
          <ErrorCard title="Preview unavailable" message={errorMessage} />
        ) : preview.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No subscriptions yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {preview.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <StatusChip status={s.status} />
                <span className="text-[var(--muted-foreground)]">
                  {s.billing_frequency ?? "—"} · started {formatDate(s.started_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" asChild className="mt-4">
          <Link href="/customers">Browse via customers</Link>
        </Button>
      </ModulePlaceholder>
    </div>
  );
}
