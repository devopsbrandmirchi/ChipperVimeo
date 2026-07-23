# Vimeo OTT ingest + admin (Vercel + Supabase)

Phase 1: capture Vimeo OTT webhooks into Supabase.  
Phase 2: admin UI for events, customers, subscriptions, and settings (scaffolded).

## Setup

1. Copy env files and fill Supabase values:

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser / future admin)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only webhook inserts — never expose to the client)

2. Apply the migration in the Supabase SQL editor (or CLI):

`supabase/migrations/001_vott_events.sql`

3. Run locally:

```bash
npm run dev
```

## Webhook URL

Point Vimeo OTT (**Manage → Site → Advanced → Webhook URLs**) at:

```text
https://<vercel-domain>/api/webhooks/vimeo
```

No shared secret / no auth on this route.

- `OPTIONS` → `204` for admin **Send test** CORS (`https://*.vhx.tv`).
- Echoes `Access-Control-Allow-Origin` to the request `Origin` when allowed; `Vary: Origin`; Max-Age `600`.
- `POST` reads `request.text()` then `JSON.parse` (body may be `text/plain` JSON).
- Returns `200` on successful insert (Vimeo retries ≤5 on non-200).
- Test payloads with many `null` fields are stored as full raw JSON.

## Layout notes

- Next.js 16 uses `src/proxy.ts` (replaces deprecated `middleware.ts`).
- Proxy matcher never includes `/api/webhooks/*`.
- Business logic: `src/services/` · DB access: `src/repositories/` · types: `src/types/vimeo.ts`
