import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/webhook-events", label: "Webhook events" },
  { href: "/customers", label: "Customers" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/settings", label: "Settings" },
] as const;

export function AdminSidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
      <Link href="/dashboard" className="mb-8 text-sm font-semibold tracking-tight">
        Vimeo OTT Admin
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-8 text-xs text-zinc-500">
        Phase 1 — ingest ready
      </div>
    </aside>
  );
}
