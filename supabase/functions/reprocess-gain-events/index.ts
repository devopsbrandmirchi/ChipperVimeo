/**
 * Supabase Edge Function: reprocess-gain-events
 *
 * Invokes the Next.js ADMIN reprocess API (app handlers) for a UTC date range.
 * Use from Supabase Dashboard → Edge Functions → Invoke, or:
 *
 *   curl -X POST "$SUPABASE_URL/functions/v1/reprocess-gain-events" \
 *     -H "Authorization: Bearer $SUPABASE_ANON_OR_SERVICE_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"startDate":"2026-07-24","endDate":"2026-07-24","limit":500}'
 *
 * Required secrets (Dashboard → Edge Functions → Secrets):
 *   APP_REPROCESS_URL   e.g. https://chipper-vimeo.vercel.app
 *   REPROCESS_SECRET    same value as Vercel env REPROCESS_SECRET
 *
 * Repeat until response data.attempted === 0.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const appBase = Deno.env.get("APP_REPROCESS_URL")?.replace(/\/$/, "");
  const secret = Deno.env.get("REPROCESS_SECRET");

  if (!appBase || !secret) {
    return json(
      {
        error:
          "Missing Edge secrets APP_REPROCESS_URL and/or REPROCESS_SECRET",
      },
      500,
    );
  }

  let body: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const startDate = body.startDate;
  const endDate = body.endDate ?? body.startDate;
  const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 2000);

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return json(
      { error: "startDate required as YYYY-MM-DD" },
      400,
    );
  }
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return json({ error: "endDate required as YYYY-MM-DD" }, 400);
  }

  const url = `${appBase}/api/v1/webhook-events/reprocess`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-reprocess-secret": secret,
    },
    body: JSON.stringify({ startDate, endDate, limit }),
  });

  const text = await upstream.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw text */
  }

  return new Response(JSON.stringify(parsed), {
    status: upstream.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
