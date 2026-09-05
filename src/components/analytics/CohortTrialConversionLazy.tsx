"use client";

import { useEffect, useState } from "react";

import { StatCard } from "@/components/cards/MetricCard";
import { LoadingSpinner } from "@/components/common/feedback";
import { apiGetClient } from "@/lib/api/client";
import type { CohortTrialConversionResponse } from "@/modules/analytics/dto/responses";

export function CohortTrialConversionLazy() {
  const [data, setData] = useState<CohortTrialConversionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGetClient<CohortTrialConversionResponse>("/analytics/cohort-trials")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load cohort trial conversion. Apply migration 045.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <StatCard title="Cohort trial conversion">
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
          <LoadingSpinner />
          Loading trial cohorts…
        </div>
      </StatCard>
    );
  }

  if (error || !data) {
    return (
      <StatCard title="Cohort trial conversion">
        <p className="py-4 text-sm text-[var(--muted-foreground)]">
          {error ?? "No trial cohort data."}
        </p>
      </StatCard>
    );
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Cohort trial conversion
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">{data.note}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
              <th className="px-3 py-2 text-left font-semibold">Cohort</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--muted-foreground)]">
                Starts
              </th>
              <th className="px-3 py-2 text-right font-medium text-[var(--muted-foreground)]">
                Converted
              </th>
              <th className="px-3 py-2 text-right font-medium text-[var(--muted-foreground)]">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.cohortMonth}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-3 py-2 font-medium">{row.cohortLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.trialsStarted.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.trialsConverted.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.conversionPct.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                  %
                </td>
              </tr>
            ))}
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-[var(--muted-foreground)]"
                >
                  No trial cohorts in range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
