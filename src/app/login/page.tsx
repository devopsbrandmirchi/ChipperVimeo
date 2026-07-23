import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Admin login</h1>
      <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
        Phase 2 will use Supabase Auth here. For now, admin pages are open
        placeholders while webhook ingest is wired up.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
      >
        Continue to dashboard
      </Link>
    </main>
  );
}
