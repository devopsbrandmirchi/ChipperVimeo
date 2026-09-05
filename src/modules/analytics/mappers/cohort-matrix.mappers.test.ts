import { describe, expect, it } from "vitest";

import {
  formatCohortMonthLabel,
  mapCohortMatrixResponse,
  resolveCohortMatrixRange,
} from "@/modules/analytics/mappers/cohort-matrix.mappers";

describe("resolveCohortMatrixRange", () => {
  it("defaults to a 3-month window ending at current UTC month", () => {
    const range = resolveCohortMatrixRange({ horizon: 6 });
    expect(range.horizon).toBe(6);
    expect(range.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-01$/);
    expect(range.from <= range.to).toBe(true);
  });

  it("accepts YYYY-MM inputs", () => {
    const range = resolveCohortMatrixRange({
      from: "2026-01",
      to: "2026-04",
      horizon: 6,
    });
    expect(range.from).toBe("2026-01-01");
    expect(range.to).toBe("2026-04-01");
  });
});

describe("formatCohortMonthLabel", () => {
  it("formats UTC month labels like the Excel sheet", () => {
    expect(formatCohortMonthLabel("2026-01-01")).toBe("January 2026");
    expect(formatCohortMonthLabel("2026-04-01")).toBe("April 2026");
  });
});

describe("mapCohortMatrixResponse", () => {
  it("pivots long RPC rows into revenue and churn grids", () => {
    const mapped = mapCohortMatrixResponse(
      [
        {
          metric: "cohort_size",
          cohort_month: "2026-01-01",
          relative_month: 0,
          value: 100,
        },
        {
          metric: "cohort_size",
          cohort_month: "2026-02-01",
          relative_month: 0,
          value: 80,
        },
        {
          metric: "revenue_cents",
          cohort_month: "2026-01-01",
          relative_month: 1,
          value: 59900,
        },
        {
          metric: "revenue_cents",
          cohort_month: "2026-01-01",
          relative_month: 2,
          value: 42000,
        },
        {
          metric: "churn_pct",
          cohort_month: "2026-01-01",
          relative_month: 1,
          value: 5.5,
        },
        {
          metric: "churn_pct",
          cohort_month: "2026-01-01",
          relative_month: 2,
          value: 12.25,
        },
      ],
      { from: "2026-01-01", to: "2026-02-01", horizon: 6 },
    );

    expect(mapped.revenue.title).toBe("Revenue");
    expect(mapped.churn.title).toBe("Churn");
    expect(mapped.revenue.columnLabels).toEqual([
      "Month 1",
      "Month 2",
      "Month 3",
      "Month 4",
      "Month 5",
      "Month 6",
    ]);

    const jan = mapped.revenue.rows[0];
    expect(jan?.cohortLabel).toBe("January 2026");
    expect(jan?.cohortSize).toBe(100);
    expect(jan?.values[0]).toBe(59900);
    expect(jan?.values[1]).toBe(42000);
    expect(jan?.values[2]).toBeNull();

    const janChurn = mapped.churn.rows[0];
    expect(janChurn?.values[0]).toBe(5.5);
    expect(janChurn?.values[1]).toBe(12.25);
    expect(janChurn?.values[5]).toBeNull();

    expect(mapped.revenue.rows[1]?.cohortLabel).toBe("February 2026");
    expect(mapped.revenue.rows[1]?.values.every((v) => v == null)).toBe(true);
  });
});
