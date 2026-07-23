import { NextResponse } from "next/server";

/**
 * Vimeo OTT admin "Send test" runs in the browser from https://*.vhx.tv
 * and requires CORS. Live webhook POSTs are server-to-server (no Origin).
 *
 * Spec:
 * - OPTIONS → 204
 * - Echo Access-Control-Allow-Origin to the request Origin when allowed
 * - Allow-Methods: POST, OPTIONS
 * - Allow-Headers: Content-Type, Accept, Origin, X-Requested-With
 * - Max-Age: 600, Vary: Origin
 * - Never emit duplicate ACAO headers
 */

const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*vhx\.tv$/i;

export function isAllowedVimeoOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    return ALLOWED_ORIGIN_PATTERN.test(origin);
  } catch {
    return false;
  }
}

/** Build CORS headers once — single ACAO value, never duplicated. */
export function buildCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");

  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Origin, X-Requested-With",
  );
  headers.set("Access-Control-Max-Age", "600");
  headers.set("Vary", "Origin");

  if (isAllowedVimeoOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function corsPreflightResponse(request: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}

export function jsonWithCors(
  request: Request,
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: buildCorsHeaders(request),
  });
}
