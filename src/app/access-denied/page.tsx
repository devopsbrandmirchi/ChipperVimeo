import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        403
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Access denied
      </h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Your account is signed in but does not have a role that can access this
        area. Ask an administrator to assign{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          ADMIN
        </span>{" "}
        (or another permitted role) in Supabase Auth app metadata.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm">
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          Sign in with another account
        </Link>
        <Link
          href="/"
          className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
