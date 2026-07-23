import { NextResponse } from "next/server";

/**
 * Phase 2: list/filter `vott_events` for the admin UI.
 * Repository method `listEvents` is ready — enable this route behind Auth.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Not implemented — Phase 2 (protect with Supabase Auth first)",
    },
    { status: 501 },
  );
}
