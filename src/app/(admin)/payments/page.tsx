import { ErrorCard, ModulePlaceholder, StatusChip } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import { formatDate } from "@/lib/utils";
import type { Payment } from "@/types/database";

export default async function PaymentsPage() {
  let preview: Payment[] = [];
  let total = 0;
  let errorMessage: string | null = null;

  try {
    const result = await apiGetServer<Payment[]>("/payments", {
      page: 1,
      pageSize: 8,
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
        title="Payments"
        description="Payments ledger layout — advanced filters arrive later."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments" },
        ]}
      />
      <ModulePlaceholder
        title="Layout ready"
        description={`Connected to GET /api/v1/payments (${total} total).`}
      >
        {errorMessage ? (
          <ErrorCard title="Preview unavailable" message={errorMessage} />
        ) : preview.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="py-2">{formatDate(p.payment_date)}</td>
                    <td className="py-2">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="py-2">
                      {p.amount_cents != null
                        ? `$${(p.amount_cents / 100).toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModulePlaceholder>
    </div>
  );
}
