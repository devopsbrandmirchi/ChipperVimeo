import { NextResponse } from "next/server";

/**
 * Phase 2: list / filter customers derived from webhook events (or synced tables).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Not implemented — Phase 2",
    },
    { status: 501 },
  );
}
