import {
  formatCohortMonthLabel,
  resolveCohortMatrixRange,
} from "@/modules/analytics/mappers/cohort-matrix.mappers";
import type { CohortMatrixFilters } from "@/modules/analytics/dto/filters";
import type { CohortTrialConversionResponse } from "@/modules/analytics/dto/responses";

export type CohortTrialConversionDbRow = {
  cohort_month: string;
  trials_started: number | string | null;
  trials_converted: number | string | null;
  conversion_pct: number | string | null;
};

function num(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function mapCohortTrialConversion(
  rows: CohortTrialConversionDbRow[],
  range: { from: string; to: string },
): CohortTrialConversionResponse {
  return {
    from: range.from,
    to: range.to,
    note: "Cohort = free_trial_start UTC month. Converted = trial_converted event on or before free_trial_end (or start + 30 days).",
    rows: rows.map((r) => {
      const cm = String(r.cohort_month).slice(0, 10);
      return {
        cohortMonth: cm,
        cohortLabel: formatCohortMonthLabel(cm),
        trialsStarted: num(r.trials_started),
        trialsConverted: num(r.trials_converted),
        conversionPct: num(r.conversion_pct),
      };
    }),
  };
}

export function resolveCohortTrialRange(
  filters: CohortMatrixFilters = { horizon: 6 },
): { from: string; to: string } {
  const { from, to } = resolveCohortMatrixRange(filters);
  return { from, to };
}
