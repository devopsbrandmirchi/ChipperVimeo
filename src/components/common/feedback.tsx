import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-5 w-5 animate-spin text-[var(--muted-foreground)]", className)}
    />
  );
}

export function EmptyState({
  title = "No results",
  description = "Try adjusting filters or search.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
      <Inbox className="h-8 w-8 text-[var(--muted-foreground)]" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorCard({
  title = "Something went wrong",
  message,
  onRetry,
  action,
  retryLabel = "Refresh",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Custom action (e.g. client Refresh button). Takes precedence over onRetry. */
  action?: ReactNode;
  retryLabel?: string;
}) {
  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardContent className="flex items-start gap-3 p-5">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          {message ? (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{message}</p>
          ) : null}
          {action ??
            (onRetry ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            ) : null)}
        </div>
      </CardContent>
    </Card>
  );
}

export function ModulePlaceholder({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  const value = (status ?? "unknown").toLowerCase();
  const variant =
    value.includes("active") || value === "succeeded" || value === "paid"
      ? "success"
      : value.includes("cancel") || value.includes("fail") || value === "expired"
        ? "danger"
        : value.includes("trial") || value.includes("pause")
          ? "warning"
          : "secondary";

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        variant === "success" &&
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        variant === "danger" &&
          "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        variant === "warning" &&
          "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        variant === "secondary" && "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
      )}
    >
      {status ?? "—"}
    </span>
  );
}

export function CountryBadge({ country }: { country: string | null | undefined }) {
  if (!country) return <span className="text-[var(--muted-foreground)]">—</span>;
  return (
    <span className="inline-flex rounded-md border border-[var(--border)] px-2 py-0.5 text-xs">
      {country}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: string | null | undefined }) {
  if (!platform) return <span className="text-[var(--muted-foreground)]">—</span>;
  return (
    <span className="inline-flex rounded-md bg-[var(--secondary)] px-2 py-0.5 text-xs capitalize">
      {platform}
    </span>
  );
}

export function LoadingTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] p-4">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
