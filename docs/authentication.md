# Authentication & Authorization

Phase 7 — Supabase Auth for the admin platform. The Vimeo webhook endpoint stays public.

## Architecture

```text
Browser → proxy.ts (cookie refresh + page redirects)
       → /api/auth/* (AuthService → AuthRepository → Supabase Auth)
       → /api/v1/*   (requireAuthorizedUser → domain services)
       → /api/webhooks/vimeo  (unguarded)
```

React never calls Supabase Auth directly. The `AuthProvider` talks only to `/api/auth/*`.

## Authentication flow

1. User submits email/password on `/login`.
2. `POST /api/auth/login` → `AuthService.login` → `signInWithPassword`.
3. Session cookies are set via `@supabase/ssr` (anon key only).
4. `AuthProvider` stores `user` + `session` from the API response.
5. On load, `GET /api/auth/me` restores state after refresh.
6. Logout clears the session via `POST /api/auth/logout`.

Password recovery:

- `POST /api/auth/forgot-password` emails a reset link (`redirectTo` → `/reset-password`).
- User opens the link (Supabase recovery session in cookies).
- `POST /api/auth/reset-password` updates the password.
- Authenticated users change password at `/change-password` via `POST /api/auth/change-password`.

## Authorization flow

Roles live in Supabase Auth **`app_metadata.role`** (no DB migration):

```json
{ "role": "ADMIN" }
```

Permissions are a **code matrix** in [`src/auth/types/permissions.ts`](../src/auth/types/permissions.ts).

| Check | Result |
|-------|--------|
| No session | **401** (API) or redirect to `/login` (pages) |
| Session, no/invalid role | **403** (API) or redirect to `/access-denied` (pages) |
| Valid role | Allowed; finer `requirePermission` available for later |

`/api/v1` uses `requireAuthorizedUser()` inside `createApiHandler` — every v1 route requires auth + assigned role.

## Protected routes

Protected (proxy redirect if unauthenticated):

- `/dashboard`, `/customers`, `/products`, `/subscriptions`, `/payments`
- `/webhook-events`, `/analytics`, `/settings`, `/change-password`

Public:

- `/login`, `/forgot-password`, `/reset-password`, `/access-denied`
- `/` (marketing/home)
- **`/api/webhooks/vimeo`** (never in the proxy matcher auth gate)

API:

- `/api/v1/*` — 401/403 JSON (cookie refresh only in proxy; no HTML redirect)
- `/api/auth/login|forgot-password|reset-password` — public
- `/api/auth/me|logout|refresh|change-password` — session required

## Role system

Roles: `ADMIN` | `MANAGER` | `ANALYST` | `READ_ONLY`

Phase 7 assigns **ADMIN** only. Other roles exist in the enum and matrix with conservative defaults so future assignment needs no redesign.

Example permissions:

- `customers:view|edit|delete|export`
- `subscriptions:view|export`
- `analytics:view|export`
- `settings:manage`

### Adding a new role

1. Add the role to `APP_ROLES` in [`src/auth/types/roles.ts`](../src/auth/types/roles.ts).
2. Add a row to `ROLE_PERMISSIONS` in [`src/auth/types/permissions.ts`](../src/auth/types/permissions.ts).
3. Assign via **Settings → Users & access** (ADMIN), or in Supabase Dashboard → Authentication → Users → App Metadata `"role": "YOUR_ROLE"`.
4. Role changes write to `public.auth_audit_events` (migration `038`).

### Bootstrap first ADMIN

1. Create a user in Supabase Auth (Email provider), **or** use Settings after one ADMIN exists.
2. Edit **App Metadata** to `{ "role": "ADMIN" }` for the first user (Dashboard only for bootstrap).
3. Sign in at `/login`.
4. Further users: **Settings → Users & access** → Invite by email or Create with password.

### Phase 11 admin APIs

| Method | Path | Permission |
|--------|------|------------|
| `GET` | `/api/v1/admin/users` | `settings:manage` |
| `POST` | `/api/v1/admin/users` | `settings:manage` (invite \| create) |
| `PATCH` | `/api/v1/admin/users/[id]` | `settings:manage` (role) |

CSV exports require `products:export` / `payments:export`.

## Session lifecycle

- Cookies managed by `@supabase/ssr` (not `localStorage`).
- [`src/proxy.ts`](../src/proxy.ts) refreshes sessions on matched routes (Next.js 16 network boundary; replaces legacy `middleware.ts`).
- Expired sessions: pages redirect to `/login?next=…`; APIs return 401.
- Authenticated users with a valid role visiting `/login` or `/forgot-password` are redirected to `/dashboard`.

## Audit logging

`AuthService` logs via `defaultLogger.child({ service: "auth" })`:

- `login` / `login_failed`
- `logout`
- `password_reset_request` / `password_reset`
- `password_change`

Phase 11 also persists admin actions to **`public.auth_audit_events`**:

- `user_invite` / `user_create`
- `role_change`

View recent events under **Settings → Access audit**.

## Security

- Anon key + cookie sessions only on the auth path.
- Service role key never used in auth or the browser.
- No JWT secrets in client code.
- Server-side `getUser()` for validation.

## Key files

| Path | Role |
|------|------|
| `src/auth/services/auth.service.ts` | Auth business logic + RBAC helpers |
| `src/auth/repositories/auth.repository.ts` | Supabase Auth calls |
| `src/auth/guards/*` | Server `requireAuth` / role checks |
| `src/auth/providers/AuthProvider.tsx` | Client auth state |
| `src/auth/hooks/useAuth.ts` | React hook |
| `src/proxy.ts` | Page protection + session refresh |
| `src/lib/supabase/server-auth.ts` | Cookie server client (anon) |
| `src/app/api/auth/*` | Auth HTTP surface |
