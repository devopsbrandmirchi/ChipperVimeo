import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  hint,
  placeholder,
}: {
  title: string;
  value: string | number;
  hint?: string;
  placeholder?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight",
            placeholder && "text-[var(--muted-foreground)]",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
