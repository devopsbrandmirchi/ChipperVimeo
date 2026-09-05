import type { CohortMatrixBlock, CohortMatrixResponse } from "@/modules/analytics/dto/responses";

function moneyFromCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(value: number): string {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatCell(
  unit: CohortMatrixBlock["unit"],
  value: number | null,
): string {
  if (value == null) return "—";
  return unit === "percent" ? pct(value) : moneyFromCents(value);
}

function MatrixTable({ block }: { block: CohortMatrixBlock }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
            <th className="px-3 py-2 text-left font-semibold">{block.title}</th>
            {block.columnLabels.map((label) => (
              <th
                key={label}
                className="px-3 py-2 text-right font-medium text-[var(--muted-foreground)]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr
              key={row.cohortMonth}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                {row.cohortLabel}
                <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                  n={row.cohortSize.toLocaleString("en-US")}
                </span>
              </td>
              {row.values.map((value, idx) => (
                <td
                  key={`${row.cohortMonth}-${idx}`}
                  className="px-3 py-2 text-right tabular-nums"
                >
                  {formatCell(block.unit, value)}
                </td>
              ))}
            </tr>
          ))}
          {block.rows.length === 0 ? (
            <tr>
              <td
                colSpan={block.columnLabels.length + 1}
                className="px-3 py-6 text-center text-[var(--muted-foreground)]"
              >
                No cohort rows for this range.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function CohortMatrix({ data }: { data: CohortMatrixResponse }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Cohort revenue, churn &amp; retention
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">{data.note}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Cohorts {data.from.slice(0, 7)} → {data.to.slice(0, 7)} · horizon{" "}
          {data.horizon} months ·{" "}
          <a
            className="underline underline-offset-2"
            href={`/api/v1/analytics/cohorts/export?from=${data.from.slice(0, 7)}&to=${data.to.slice(0, 7)}&horizon=${data.horizon}`}
          >
            Export CSV
          </a>
        </p>
      </div>
      <div className="space-y-6">
        <MatrixTable block={data.revenue} />
        <MatrixTable block={data.churn} />
        <MatrixTable block={data.retention} />
      </div>
    </section>
  );
}
