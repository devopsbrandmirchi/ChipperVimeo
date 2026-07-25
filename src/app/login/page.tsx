import { Suspense } from "react";

import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(24,24,27,0.08),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(250,250,250,0.06),_transparent_55%)]"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mb-8 flex flex-col gap-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Vimeo OTT
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Admin sign in
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your credentials to access the analytics platform.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
