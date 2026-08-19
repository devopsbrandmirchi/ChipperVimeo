"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPostClient } from "@/lib/api/client";

export function RefreshDashboardButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onRefresh() {
    setError(null);
    try {
      await apiPostClient("/analytics/refresh", { target: "dashboard" });
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => void onRefresh()}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Refresh snapshot
      </Button>
      {error ? (
        <span className="text-xs text-[var(--destructive)]">{error}</span>
      ) : null}
    </div>
  );
}
