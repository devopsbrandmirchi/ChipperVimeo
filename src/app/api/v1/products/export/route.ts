import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { csvResponse, rowsToCsv } from "@/app/api/v1/_shared/csv";
import {
  parseSearchParams,
  productListQuerySchema,
} from "@/app/api/v1/_shared/schemas";
import { requirePermission } from "@/auth/guards/role.guard";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId, user }) => {
  requirePermission(user, "products:export");
  const query = parseSearchParams(
    productListQuerySchema,
    request.nextUrl.searchParams,
  );
  const { products } = createApiServices();
  const { items } = await products.listForExport({
    active: query.active,
    sku: query.sku,
    name: query.name,
    search: query.search,
  });

  const csv = rowsToCsv(
    [
      "id",
      "vimeo_product_id",
      "name",
      "sku",
      "active",
      "currency",
      "monthly_price_cents",
      "yearly_price_cents",
      "free_trial_enabled",
      "free_trial_days",
      "updated_at",
    ],
    items.map((p) => [
      p.id,
      p.vimeo_product_id,
      p.name,
      p.sku,
      p.active,
      p.currency,
      p.monthly_price_cents,
      p.yearly_price_cents,
      p.free_trial_enabled,
      p.free_trial_days,
      p.updated_at,
    ]),
  );

  return csvResponse("products-export.csv", csv, requestId);
});
