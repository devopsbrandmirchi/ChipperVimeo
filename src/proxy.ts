import { type NextRequest, NextResponse } from "next/server";

import { isAppRole } from "@/auth/types/roles";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/access-denied",
]);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/customers",
  "/products",
  "/subscriptions",
  "/payments",
  "/webhook-events",
  "/analytics",
  "/settings",
  "/change-password",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Next.js 16 network boundary (formerly middleware.ts).
 * - Refreshes auth cookies
 * - Redirects unauthenticated users away from admin pages
 * - Never gates `/api/webhooks/*` (matcher excludes it)
 * - API routes get cookie refresh only; handlers return 401/403 JSON
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // API: refresh cookies only — no HTML redirects.
  if (isApiPath(pathname)) {
    return response;
  }

  const authenticated = Boolean(user);
  const hasRole = user?.role ? isAppRole(user.role) : false;

  if (isProtectedPath(pathname)) {
    if (!authenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!hasRole) {
      const denied = request.nextUrl.clone();
      denied.pathname = "/access-denied";
      denied.search = "";
      return NextResponse.redirect(denied);
    }
    return response;
  }

  if (isPublicAuthPath(pathname) && authenticated && hasRole) {
    // Reset-password must stay reachable while recovering a session from email link.
    if (pathname === "/reset-password" || pathname === "/access-denied") {
      return response;
    }
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    dashboard.search = "";
    return NextResponse.redirect(dashboard);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/subscriptions/:path*",
    "/payments/:path*",
    "/webhook-events/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/change-password",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/access-denied",
    "/api/v1/:path*",
    "/api/auth/:path*",
  ],
};
