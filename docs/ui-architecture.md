# UI Architecture

Phase 8 — Admin dashboard consumes authenticated `/api/v1` APIs. React never talks to Supabase or domain services directly.

## Hierarchy

```text
RootLayout (ThemeProvider + AuthProvider + Toaster)
└── (admin)/layout → AppShell
    ├── Sidebar (nav + logout)
    ├── Topbar (search, theme, notifications placeholder, UserMenu)
    └── page (Server Component by default)
```

## Routing

| Route | Depth |
|-------|--------|
| `/dashboard` | Full metrics + charts |
| `/customers` | Production list (filters, sort via URL, pagination) |
| `/customers/[id]` | Detail: profile, subs, timeline, payments, webhooks |
| `/webhook-events` | Production table + raw JSON dialog |
| `/subscriptions`, `/products`, `/payments` | Layout + live API preview |
| `/analytics` | Layout + placeholder charts from analytics APIs |
| `/settings` | Profile, theme, health, webhook note |

Auth pages (`/login`, password flows, `/access-denied`) stay outside `(admin)`.

## Server vs Client

**Server Components (default):** pages, `PageHeader`, metric grids, RSC data fetching via [`src/lib/api/server.ts`](../src/lib/api/server.ts).

**Client (`"use client"`):** Sidebar/Topbar/UserMenu/ThemeToggle, TanStack tables, filters, Recharts, dialogs, Auth/theme hooks.

## API usage

```text
src/lib/api/
  client.ts   // browser fetch, credentials: same-origin
  server.ts   // RSC fetch with Cookie header
  errors.ts   // ApiClientError (401/403/404/…)
```

- Envelope: `BaseApiResponse` (`success`, `data`, `meta`, `errors`).
- Auth: session **cookies** (Phase 7). No Bearer header.
- Note: [`docs/rest-api.md`](rest-api.md) still says “unauthenticated this phase” — **outdated**; UI requires a signed-in user with `app_metadata.role`.

Base URL for RSC: `NEXT_PUBLIC_APP_URL`, else `x-forwarded-host` / `host` from request headers.

## State management

- Auth: `AuthProvider` / `useAuth` (session from `/api/auth/*`).
- Theme: `next-themes` (`light` | `dark` | `system`), class on `<html>`.
- List filters/pagination: **URL search params** (shareable, SSR-friendly).
- No global client store for domain data.

## Reusable components

| Area | Examples |
|------|----------|
| `components/ui` | Button, Card, Badge, Dialog, Input, Sheet, Avatar |
| `components/layout` | AppShell, Sidebar, Topbar, PageHeader, Breadcrumbs |
| `components/tables` | DataTable, Pagination |
| `components/charts` | Line/Area/Bar/Pie (Recharts) |
| `components/common` | EmptyState, ErrorCard, StatusChip, LoadingTable |
| `components/cards` | MetricCard, StatCard |

Guidelines:

1. Fetch only through `apiGetServer` / `apiGetClient`.
2. Analytics KPIs must come from `/api/v1/analytics/*` (analytics schema), never from operational tables or `vott_events` in the UI.
3. Keep pages thin — compose section components.
4. Prefer URL state over local filter state for lists.
5. Lazy-load charts (`next/dynamic`) on dashboard/analytics.
6. Do not import `@/repositories`, `@/services` implementations, or service-role clients from UI (type-only imports from service interfaces are acceptable).

## Design tokens

Zinc/neutral CSS variables in [`src/app/globals.css`](../src/app/globals.css). Soft borders, rounded cards, consistent spacing. Dark mode via `.dark` class.
