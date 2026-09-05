"use client";

import { useEffect, useState } from "react";

import { CohortMatrix } from "@/components/analytics/CohortMatrix";
import { StatCard } from "@/components/cards/MetricCard";
import { LoadingSpinner } from "@/components/common/feedback";
import { apiGetClient } from "@/lib/api/client";
import type { CohortMatrixResponse } from "@/modules/analytics/dto/responses";

/**
 * Loads the heavy cohort RPC after the page is interactive so it does not
 * compete with gain/loss / charts on the initial server render.
 */
export function CohortMatrixLazy() {
  const [data, setData] = useState<CohortMatrixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGetClient<CohortMatrixResponse>("/analytics/cohorts")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load cohort matrix. Apply migration 044 and run analytics.refresh_cohort_matrix().",
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
      <StatCard title="Cohort matrix">
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
          <LoadingSpinner />
          Computing cohort revenue &amp; churn…
        </div>
      </StatCard>
    );
  }

  if (error || !data) {
    return (
      <StatCard title="Cohort matrix">
        <p className="py-4 text-sm text-[var(--muted-foreground)]">
          {error ?? "No cohort data."}
        </p>
      </StatCard>
    );
  }

  return <CohortMatrix data={data} />;
}
