"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  AuthSession,
  AuthUser,
  LoginInput,
} from "@/auth/types/auth";
import type { Permission } from "@/auth/types/permissions";
import type { AppRole } from "@/auth/types/roles";
import type { BaseApiResponse } from "@/types/api-response";

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

async function parseApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as BaseApiResponse<T>;
  if (!response.ok || !body.success) {
    const detail = body.errors?.[0]?.message ?? body.message;
    throw new Error(detail || "Request failed");
  }
  if (body.data === undefined) {
    throw new Error(body.message || "Empty response");
  }
  return body.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback(
    (next: { user: AuthUser; session: AuthSession } | null) => {
      setUser(next?.user ?? null);
      setSession(next?.session ?? null);
    },
    [],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      applyAuth(null);
      return;
    }
    const data = await parseApi<{ user: AuthUser; session: AuthSession }>(
      response,
    );
    applyAuth(data);
  }, [applyAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) applyAuth(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, applyAuth]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await parseApi<{ user: AuthUser; session: AuthSession }>(
        response,
      );
      applyAuth(data);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!response.ok) {
      await parseApi<{ ok: boolean }>(response);
    }
    applyAuth(null);
  }, [applyAuth]);

  const hasRole = useCallback(
    (role: AppRole) => user?.role === role,
    [user],
  );

  const hasPermission = useCallback(
    (permission: Permission) =>
      Boolean(user?.permissions.includes(permission)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      login,
      logout,
      refresh,
      hasRole,
      hasPermission,
    }),
    [
      user,
      session,
      loading,
      login,
      logout,
      refresh,
      hasRole,
      hasPermission,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
