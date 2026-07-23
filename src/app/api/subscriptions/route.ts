import { NextResponse } from "next/server";

/**
 * Phase 2: list / filter subscriptions derived from product webhook topics.
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
