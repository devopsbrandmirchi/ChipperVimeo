/**
 * Supabase Edge Function: reprocess-loss-events
 *
 * Calls Next.js reprocess API with kind=loss (set_cancellation / cancelled /
 * expired / disabled / free_trial_expired). Max limit 25 for Edge ~60s.
 *
 * Secrets (same as gain):
 *   APP_REPROCESS_URL, REPROCESS_SECRET
 *
 * Cron body example:
 *   { "startDate": "2026-07-21", "endDate": "2026-07-28", "limit": 25 }
 * Or omit dates → last 7 UTC days.
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-reprocess-secret",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function defaultUtcRange(days = 7): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: utcYmd(start), endDate: utcYmd(end) };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "GET") {
      const hasUrl = Boolean(Deno.env.get("APP_REPROCESS_URL"));
      const hasSecret = Boolean(Deno.env.get("REPROCESS_SECRET"));
      return json({
        ok: hasUrl && hasSecret,
        kind: "loss",
        hasAppReprocessUrl: hasUrl,
        hasReprocessSecret: hasSecret,
        defaultRange: defaultUtcRange(7),
        hint: "POST { startDate, endDate, limit: 25 } or { lookbackDays: 7 }",
      });
    }

    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const appBase = (Deno.env.get("APP_REPROCESS_URL") ?? "")
      .replace(/\/$/, "")
      .trim();
    const secret = (Deno.env.get("REPROCESS_SECRET") ?? "").trim();

    if (!appBase || !secret || secret.length < 16) {
      return json(
        {
          success: false,
          error: "Missing or short Edge secrets APP_REPROCESS_URL / REPROCESS_SECRET",
        },
        500,
      );
    }

    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const lookbackDays = Math.min(
      Math.max(Number(body.lookbackDays) || 7, 1),
      90,
    );
    const defaults = defaultUtcRange(lookbackDays);
    const startDate = String(body.startDate ?? defaults.startDate);
    const endDate = String(body.endDate ?? body.startDate ?? defaults.endDate);
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 25);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return json(
        {
          success: false,
          error: "startDate/endDate required as YYYY-MM-DD",
        },
        400,
      );
    }

    const url = `${appBase}/api/v1/webhook-events/reprocess`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-reprocess-secret": secret,
        },
        body: JSON.stringify({
          kind: "loss",
          startDate,
          endDate,
          limit,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const timedOut = message.toLowerCase().includes("abort");
      return json(
        {
          success: false,
          error: timedOut
            ? "Batch timed out (Edge ~60s limit)"
            : "Failed to reach app reprocess API",
          detail: message,
          hint: "Use limit 25 and invoke repeatedly until attempted is 0",
        },
        timedOut ? 504 : 502,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await upstream.text();
    let parsed: Record<string, unknown>;
    try {
      const value = JSON.parse(text) as unknown;
      parsed =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : { success: upstream.ok, data: value };
    } catch {
      parsed = {
        success: false,
        error: "App returned non-JSON",
        bodyPreview: text.slice(0, 500),
      };
    }

    return json(
      {
        ...parsed,
        _meta: {
          kind: "loss",
          upstreamStatus: upstream.status,
          limit,
          startDate,
          endDate,
        },
      },
      upstream.status >= 100 && upstream.status < 600 ? upstream.status : 502,
    );
  } catch (err) {
    return json(
      {
        success: false,
        error: "Unhandled Edge Function error",
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});
