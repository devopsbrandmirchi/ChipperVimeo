"use client";

import { Loader2 } from "lucide-react";

/** Immediate pending feedback while filter navigation / RSC reload runs. */
export function FilterPendingBanner({
  pending,
  label = "Applying filters… loading results",
}: {
  pending: boolean;
  label?: string;
}) {
  if (!pending) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
