import { NextResponse } from "next/server";

/**
 * Phase 2: Supabase Auth helpers (sign-in/out callbacks) can live here,
 * or use `@supabase/ssr` client-side + Auth UI.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Not implemented — Phase 2 Auth",
    },
    { status: 501 },
  );
}
