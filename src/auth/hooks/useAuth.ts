"use client";

import { useContext } from "react";

import { AuthContext } from "@/auth/providers/AuthProvider";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return {
    user: ctx.user,
    session: ctx.session,
    loading: ctx.loading,
    login: ctx.login,
    logout: ctx.logout,
    refresh: ctx.refresh,
    hasRole: ctx.hasRole,
    hasPermission: ctx.hasPermission,
    isAuthenticated: Boolean(ctx.user),
    roles: ctx.user?.role ? [ctx.user.role] : [],
    permissions: ctx.user?.permissions ?? [],
  };
}
