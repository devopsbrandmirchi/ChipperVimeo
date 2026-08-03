"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ErrorCard, LoadingSpinner } from "@/components/common/feedback";
import { Button } from "@/components/ui/button";

/**
 * Server-page friendly error card with a Refresh that re-runs RSC data fetch.
 */
export function RefreshErrorCard({
  title,
  message,
}: {
  title?: string;
  message?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorCard
      title={title}
      message={message}
      action={
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        >
          {pending ? (
            <>
              <LoadingSpinner className="h-3.5 w-3.5" />
              Refreshing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
      }
    />
  );
}
