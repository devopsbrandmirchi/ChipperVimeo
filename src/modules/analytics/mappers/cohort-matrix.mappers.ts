import type { CohortMatrixFilters } from "@/modules/analytics/dto/filters";
import type {
  CohortMatrixBlock,
  CohortMatrixResponse,
  CohortMatrixRow,
} from "@/modules/analytics/dto/responses";

export type CohortMatrixDbRow = {
  metric: string;
  cohort_month: string;
  relative_month: number;
  value: number | string | null;
};

function toMonthStartIso(input: string): string {
  const raw = input.length === 7 ? `${input}-01` : input.slice(0, 10);
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid cohort month: ${input}`);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function addUtcMonths(monthStartIso: string, delta: number): string {
  const d = new Date(`${monthStartIso}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Default: last 4 UTC calendar months ending at current month. */
export function resolveCohortMatrixRange(
  filters: CohortMatrixFilters = { horizon: 6 },
): { from: string; to: string; horizon: number } {
  const horizon = filters.horizon ?? 6;
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const to = filters.to ? toMonthStartIso(filters.to) : current;
  const from = filters.from
    ? toMonthStartIso(filters.from)
    : addUtcMonths(to, -3);
  return { from, to, horizon };
}

export function formatCohortMonthLabel(monthStartIso: string): string {
  const d = new Date(`${monthStartIso.slice(0, 10)}T00:00:00.000Z`);
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function num(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function monthKey(raw: string): string {
  return raw.slice(0, 10) <= "9999-12-31" ? raw.slice(0, 10) : raw;
}

/**
 * Pivot long RPC rows into Excel-shaped Revenue + Churn blocks.
 * Missing cells (future relative months) become null.
 */
export function mapCohortMatrixResponse(
  rows: CohortMatrixDbRow[],
  range: { from: string; to: string; horizon: number },
): CohortMatrixResponse {
  const { from, to, horizon } = range;
  const columnLabels = Array.from(
    { length: horizon },
    (_, i) => `Month ${i + 1}`,
  );

  const cohortMonths: string[] = [];
  for (
    let cur = from;
    cur <= to;
    cur = addUtcMonths(cur, 1)
  ) {
    cohortMonths.push(cur);
  }

  const sizes = new Map<string, number>();
  const revenue = new Map<string, Map<number, number>>();
  const churn = new Map<string, Map<number, number>>();

  for (const row of rows) {
    const cm = monthKey(row.cohort_month);
    const rel = Number(row.relative_month);
    if (row.metric === "cohort_size") {
      sizes.set(cm, num(row.value));
      continue;
    }
    if (row.metric !== "revenue_cents" && row.metric !== "churn_pct") continue;
    if (rel < 1 || rel > horizon) continue;
    const bucket = row.metric === "churn_pct" ? churn : revenue;
    if (!bucket.has(cm)) bucket.set(cm, new Map());
    bucket.get(cm)!.set(rel, num(row.value));
  }

  const buildRows = (
    bucket: Map<string, Map<number, number>>,
  ): CohortMatrixRow[] =>
    cohortMonths.map((cm) => {
      const cells = bucket.get(cm);
      const values: Array<number | null> = [];
      for (let rel = 1; rel <= horizon; rel += 1) {
        values.push(cells?.has(rel) ? (cells.get(rel) ?? null) : null);
      }
      return {
        cohortMonth: cm,
        cohortLabel: formatCohortMonthLabel(cm),
        cohortSize: sizes.get(cm) ?? 0,
        values,
      };
    });

  const revenueBlock: CohortMatrixBlock = {
    title: "Revenue",
    unit: "currency_cents",
    columnLabels,
    rows: buildRows(revenue),
  };

  const churnBlock: CohortMatrixBlock = {
    title: "Churn",
    unit: "percent",
    columnLabels,
    rows: buildRows(churn),
  };

  return {
    from,
    to,
    horizon,
    note: "Cohort = customer first seen (UTC). Month 1 = cohort month. Churn % = customers with any cancelled_at by end of relative month ÷ cohort size.",
    revenue: revenueBlock,
    churn: churnBlock,
  };
}
