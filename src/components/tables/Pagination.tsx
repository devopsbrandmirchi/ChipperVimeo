"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (totalPages <= 1) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        {total} result{total === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Server-friendly pagination using Link (no client router required). */
export function PaginationLinks({
  page,
  totalPages,
  total,
  basePath,
  query,
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  function href(nextPage: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v) params.set(k, v);
    }
    params.set("page", String(nextPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        Page {page} of {Math.max(totalPages, 1)} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page + 1)}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
