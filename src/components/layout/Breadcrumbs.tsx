import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium" : "text-[var(--muted-foreground)]"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
