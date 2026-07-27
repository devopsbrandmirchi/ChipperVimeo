/**
 * Supabase Edge Function: reprocess-gain-events
 *
 * Calls the Next.js reprocess API in small batches (max 25) to fit Edge ~60s.
 *
 * Cron-friendly: omit startDate/endDate → last 7 UTC days through today.
 * Schedule every 5–15 minutes until backlog is cleared, then hourly/daily.
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   APP_REPROCESS_URL  = https://chipper-vimeo.vercel.app
 *   REPROCESS_SECRET   = same as Vercel REPROCESS_SECRET (min 16 chars)
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

/** Inclusive window: today UTC back `(days - 1)` days. */
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
      const range = defaultUtcRange(7);
      return json({
        ok: hasUrl && hasSecret,
        hasAppReprocessUrl: hasUrl,
        hasReprocessSecret: hasSecret,
        defaultRange: range,
        hint: hasUrl && hasSecret
          ? "Secrets OK. Cron can POST {} or { lookbackDays: 7, limit: 25 }"
          : "Set Edge secrets APP_REPROCESS_URL and REPROCESS_SECRET",
      });
    }

    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const appBaseRaw = Deno.env.get("APP_REPROCESS_URL") ?? "";
    const appBase = appBaseRaw.replace(/\/$/, "").trim();
    const secret = (Deno.env.get("REPROCESS_SECRET") ?? "").trim();

    if (!appBase || !secret) {
      return json(
        {
          success: false,
          error: "Missing Edge secrets",
          hasAppReprocessUrl: Boolean(appBase),
          hasReprocessSecret: Boolean(secret),
          fix: "Dashboard → Edge Functions → Secrets → add APP_REPROCESS_URL and REPROCESS_SECRET",
        },
        500,
      );
    }

    if (secret.length < 16) {
      return json(
        {
          success: false,
          error: "REPROCESS_SECRET must be at least 16 characters",
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return json(
        { success: false, error: "startDate required as YYYY-MM-DD" },
        400,
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return json(
        { success: false, error: "endDate required as YYYY-MM-DD" },
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
        body: JSON.stringify({ startDate, endDate, limit }),
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const timedOut =
        message.toLowerCase().includes("abort") ||
        message.toLowerCase().includes("timed out");
      return json(
        {
          success: false,
          error: timedOut
            ? "Batch timed out (Edge ~60s limit)"
            : "Failed to reach app reprocess API",
          detail: message,
          url,
          hint: timedOut
            ? "Cron should use limit 25 every few minutes until attempted is 0."
            : "Check APP_REPROCESS_URL, Vercel deploy, and REPROCESS_SECRET",
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
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      } else {
        parsed = { success: upstream.ok, data: value };
      }
    } catch {
      parsed = {
        success: false,
        error: "App returned non-JSON",
        status: upstream.status,
        bodyPreview: text.slice(0, 500),
      };
    }

    return json(
      {
        ...parsed,
        _meta: {
          upstreamStatus: upstream.status,
          limit,
          startDate,
          endDate,
          lookbackDays,
          cronFriendly: true,
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
