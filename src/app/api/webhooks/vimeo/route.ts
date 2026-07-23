import { corsPreflightResponse, jsonWithCors } from "@/utils/cors";
import { insertEvent } from "@/repositories/vott-events.repository";
import {
  normalizeVimeoWebhookPayload,
  parseVimeoWebhookBody,
} from "@/services/vimeo-webhook.service";

export const runtime = "nodejs";

/**
 * Vimeo OTT webhook ingest — no auth, no shared secret.
 *
 * Register URL: https://<vercel-domain>/api/webhooks/vimeo
 *
 * - OPTIONS: CORS preflight for admin Send test (https://*.vhx.tv)
 * - POST: body may be text/plain JSON → text() then JSON.parse; store raw payload
 * - 200 after successful insert (Vimeo retries ≤5 on non-200)
 * - Test payloads may be mostly null — tolerated
 *
 * @see https://help.vimeo.com/hc/en-us/articles/12427285998225-Create-a-Vimeo-OTT-webhook
 * @see https://dev.vhx.tv/integrations/
 */
export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  try {
    // Vimeo often sends Content-Type: text/plain;charset=UTF-8 with JSON inside.
    const bodyText = await request.text();
    let raw: unknown;

    try {
      raw = parseVimeoWebhookBody(bodyText);
    } catch {
      return jsonWithCors(
        request,
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    // Normalize for indexes; always persist full raw JSON (null-heavy tests OK).
    const event = normalizeVimeoWebhookPayload(raw);
    const saved = await insertEvent(event);

    return jsonWithCors(request, {
      ok: true,
      id: saved.id,
      topic: saved.topic,
    });
  } catch (error) {
    console.error("[vimeo-webhook]", error);
    // Non-200 so Vimeo can retry (up to 5 times) on transient failures.
    return jsonWithCors(
      request,
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook ingest failed",
      },
      { status: 500 },
    );
  }
}
