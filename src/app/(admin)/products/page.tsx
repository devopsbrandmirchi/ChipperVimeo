import { ErrorCard, ModulePlaceholder, StatusChip } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";
import type { Product } from "@/types/database";

export default async function ProductsPage() {
  let preview: Product[] = [];
  let total = 0;
  let errorMessage: string | null = null;

  try {
    const result = await apiGetServer<Product[]>("/products", {
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
        title="Products"
        description="Product catalog layout — full editor arrives later."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Products" },
        ]}
      />
      <ModulePlaceholder
        title="Layout ready"
        description={`Connected to GET /api/v1/products (${total} total).`}
      >
        {errorMessage ? (
          <ErrorCard title="Preview unavailable" message={errorMessage} />
        ) : preview.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No products yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {preview.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.name ?? p.sku ?? p.id}</span>
                  <StatusChip status={p.active ? "active" : "inactive"} />
                </div>
                {p.sku ? (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    SKU {p.sku}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ModulePlaceholder>
    </div>
  );
}
