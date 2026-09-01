"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPostClient } from "@/lib/api/client";

function friendlyRefreshError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("statement timeout") || lower.includes("canceling statement")) {
    return "Snapshot refresh timed out (DB still too large for API refresh). Run in Supabase SQL: select analytics.refresh_dashboard();";
  }
  return message;
}

export function RefreshDashboardButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loading = busy || isPending;

  async function onRefresh() {
    setError(null);
    setStatus("Refreshing snapshot… this can take several minutes");
    setBusy(true);
    try {
      await apiPostClient("/analytics/refresh", { target: "dashboard" });
      setStatus("Snapshot updated — reloading…");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Refresh failed";
      setError(friendlyRefreshError(raw));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          aria-busy={loading}
          onClick={() => void onRefresh()}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {loading ? "Refreshing…" : "Refresh snapshot"}
        </Button>
      </div>
      {status && !error ? (
        <div
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{status}</span>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-[var(--destructive)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--destructive)] dark:bg-red-950/40"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
