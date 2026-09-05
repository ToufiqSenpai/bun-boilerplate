# Research #34: backend–web auth seam for user management

Source: issue #34 (part of map #32). Read-only investigation; no code changes.

## 1. Enforcement flow (backend)

**The `permissions` macro does NOT cover `/api/auth/admin/*` — only article routes.**

- Macro (`packages/backend/src/modules/auth/index.ts:211-233`): `auth.api.getSession({headers})` → 401 if no session (`:215`), 401 if `!emailVerified` (`:216`), 403 if role missing/unknown (`:220`), 403 if `userHasPermission` fails (`:222-226`), else injects `{user, session}`.
- Only 3 call sites, all article content routes (`packages/backend/src/modules/article/index.ts:80,100,122`).
- Admin routes (`/api/auth/admin/*`) are served by `.mount(auth.handler)` (`auth/index.ts:210`), bypassing Elysia routing — better-auth's own `admin({ ac, roles })` plugin (`:148`) enforces them internally against the same `ac`/`roles` from `permissions.ts`. No Elysia `permissions:` key, no OpenAPI entry via `authTags`.
- No custom backend wrapper endpoints exist for users/sessions.

Role matrix (`permissions.ts:10-25`, pinned by `index.test.ts:9-29`): `superadmin` = full `adminAc.statements` + content; `admin` = content only, ZERO user/session grants. `superadmin` explicitly lacks `user:impersonate-admins` (`index.test.ts:19`).

## 2. Session / cookie / CORS

- Cookie: `better-auth.session_token` (`main.ts:41,51-56`). Source of truth: `auth.api.getSession({ headers })` with raw cookie headers.
- `emailVerified` gate backend-enforced (401) for macro routes; first-user auto-promotion to `superadmin` in `databaseHooks.user.create.after` (`:164-171`).
- Role column nullable text (`tables/auth.table.ts:11`); `banned/banReason/banExpires` already in schema.
- CORS/trustedOrigins/baseURL single-sourced from `config.app` (`common/config.ts:19-20,87`): `trustedOrigins = origins` (`:67`), `baseURL` (`:66`), `cors({ origin, credentials: true, ... })` (`main.ts:76-82`). better-auth 1.7.1 both packages.

## 3. Web session-reader / access verdict

- `session-reader.ts:1-24`: `authClient.getSession()` (`:6`), unsafe cast for `role` (`:12`) — generic client type omits the admin-plugin `role` field.
- `access.ts:28-43`: `KNOWN_ROLES = {superadmin, admin}`; **does NOT distinguish superadmin from admin today** — both → `"allowed"` (confirmed by `access.test.ts:46-49`). A superadmin-only Users UI needs a new gate (e.g. `resolveSuperadminAccess` or role param).

## 4. Eden / authClient pattern

- `packages/web/src/utils/client.ts:1-14`: `api = treaty<App>(...).api` (typed custom Elysia routes only) + `authClient = createAuthClient({ baseURL + "/api/auth", credentials: "include" })` — **no `adminClient()` plugin**, so `authClient.admin.*` is unavailable.
- Call sites: `api.auth.setup.get()` (`_admin/route.tsx:11`); `authClient.signIn.email`, `signUp.email`, `sendVerificationEmail` (login/setup pages).

## 5. Gap list

1. No web binding for admin endpoints — `.mount(auth.handler)` is opaque to Eden; raw `fetch` would work but is untyped.
2. `adminClient()` plugin missing on web — the typed path (`listUsers/setRole/banUser/...`) without backend wrappers. better-auth 1.7.1 supports all server-side.
3. No backend wrappers — decision needed: direct handler calls via `adminClient` vs custom `/api/users/*` Elysia routes reusing the `permissions` macro with `{ user: [...] }` / `{ session: [...] }`.
4. Web gate can't express superadmin-only — must add role-discriminating check or `admin` users see buttons that 403.
5. Admin reset-password flow exists server-side (`revokeSessionsOnPasswordReset: true`) but has no web caller.
6. Minor: `session-reader` role cast (`:12`) unvalidated — new gate should validate client-side (currently `isKnownRole` is backend-only).
