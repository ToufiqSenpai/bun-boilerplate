# First admin requires email Verification before Session

Date: 2026-09-01

## Status

Accepted

## Context

`better-auth` is configured with `requireEmailVerification: true` and `sendOnSignUp: true` (`packages/backend/src/modules/auth/index.ts:95-144`), yet `databaseHooks.user.create.after` at `index.ts:168-174` auto-promoted the first `User` to `Role: admin` and set `emailVerified: true`, bypassing `Verification`. The web `Setup` page at `packages/web/src/routes/admin/setup.tsx:64-75` navigated to `/admin/login` immediately after `signUp`, so no verification-pending UI was ever shown. This contradicted the glossary `Verification` (time-bound proof) and `Session` (only after Verification) and hid the `Setup` success state.

Alternatives considered:

- **Keep bypass (auto-verify first admin):** simplest, no Session gate, but violates `requireEmailVerification` contract and leaves first admin email unverified — hard to reverse once instances ship with unverified admins.
- **Gate at `admin` macro only:** `Session` would be valid for unverified users elsewhere, only `admin` routes blocked — inconsistent.
- **Disable `autoSignIn` and gate at `auth` macro:** `Session` is only valid when `emailVerified`, enforced centrally; `Setup` shows in-place pending Card with Resend.

## Decision

Remove `emailVerified: true` from the first-user hook (keep only `role: admin`), set `emailAndPassword.autoSignIn: false`, and enforce `emailVerified` in the Elysia `auth` macro (return `401` if `!user.emailVerified`). `Setup` on success renders an in-place verification-pending Card on `/admin/setup` (no navigation, no new route, no storage — reload reconstructs via server error) with `Resend` (`authClient.sendVerificationEmail`, 60s cooldown) and 30-minute expiry copy. Copy under `admin.setup.success.*` in both `en`/`id`.

## Consequences

- First `User` with `Role: admin` must complete `Verification` before any `Session` is established; `Setup` succeeds only after `Verification`, not on `signUp` alone (see `CONTEXT.md` `Setup`/`Verification`/`Session`).
- All authenticated routes are gated on `Verification`, not just admin — unverified sign-ins are rejected at `auth` layer.
- `Setup` loader `api.auth.setup.get` (`needed`) now coexists with pending state: reload (Option A) shows form again; prior email conflict reconstructs pending Alert without `sessionStorage` or new endpoint.

## References

- Spec: GitHub issue #3 (`ToufiqSenpai/bun-boilerplate`)
- Glossary: `CONTEXT.md` (`User`, `Account`, `Session`, `Verification`, `Role`, `Setup`, `Locale`)
- Code: `packages/backend/src/modules/auth/index.ts:95-174,215-233`, `packages/web/src/routes/admin/setup.tsx:42-77`
