import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 network boundary (formerly middleware.ts).
 * Matcher excludes /api/webhooks/* so Vimeo deliveries are never gated.
 * Phase 2: add auth redirects for admin routes here.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match admin + login pages for future session refresh / auth.
     * Explicitly do NOT match /api/webhooks/* (or any API) so ingest
     * cannot be blocked by auth or cookie logic.
     */
    "/dashboard/:path*",
    "/webhook-events/:path*",
    "/customers/:path*",
    "/subscriptions/:path*",
    "/settings/:path*",
    "/login",
  ],
};
