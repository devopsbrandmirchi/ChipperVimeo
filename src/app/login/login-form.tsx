"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/auth/hooks/useAuth";
import {
  loginSchema,
  type LoginFormValues,
} from "@/auth/types/schemas";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const busy = isSubmitting || redirecting;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });
      const next = searchParams.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/dashboard";
      // Soft navigate so the shell streams immediately; AuthProvider already
      // has the session (avoids a full document reload of heavy RSC work).
      setRedirecting(true);
      router.replace(safeNext);
      router.refresh();
    } catch (error) {
      setRedirecting(false);
      setFormError(
        error instanceof Error ? error.message : "Unable to sign in",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          disabled={busy}
          className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            prefetch={false}
            className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            disabled={busy}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white py-2 pr-11 pl-3 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={busy}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          className="size-4 rounded border-zinc-300 dark:border-zinc-600"
          disabled={busy}
          {...register("rememberMe")}
        />
        Remember me
      </label>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-lg bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {redirecting
          ? "Opening dashboard…"
          : isSubmitting
            ? "Signing in…"
            : "Sign in"}
      </button>
    </form>
  );
}
