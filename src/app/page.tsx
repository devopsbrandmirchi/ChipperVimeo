import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Vimeo OTT
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Webhook ingest
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Phase 1 captures Vimeo OTT webhooks into Supabase. Point your OTT
          site webhook URL at{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
            /api/webhooks/vimeo
          </code>
          .
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Open admin
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Login (Phase 2)
        </Link>
      </div>
    </main>
  );
}
