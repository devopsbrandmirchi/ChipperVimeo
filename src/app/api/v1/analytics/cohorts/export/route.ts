import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { csvResponse, rowsToCsv } from "@/app/api/v1/_shared/csv";
import { parseCohortMatrixFilters } from "@/modules/analytics/controller/analytics.controller";
import { requirePermission } from "@/auth/guards/role.guard";
import { createApiServices } from "@/lib/api/service-container";

export const GET = createApiHandler(async ({ request, requestId, user }) => {
  requirePermission(user, "analytics:export");
  const filters = parseCohortMatrixFilters(request);
  const { analytics } = createApiServices();
  const data = await analytics.getCohortMatrix(filters);

  const rows: Array<Array<string | number | null>> = [];
  for (const block of [data.revenue, data.churn, data.retention]) {
    for (const row of block.rows) {
      rows.push([
        block.title,
        row.cohortMonth,
        row.cohortLabel,
        row.cohortSize,
        ...row.values.map((v) => (v == null ? "" : v)),
      ]);
    }
  }

  const headers = [
    "metric",
    "cohort_month",
    "cohort_label",
    "cohort_size",
    ...data.revenue.columnLabels.map((l) => l.toLowerCase().replace(/\s+/g, "_")),
  ];

  return csvResponse(
    "cohort-matrix-export.csv",
    rowsToCsv(headers, rows),
    requestId,
  );
});
