# Verification email is sent from the Verify Email page, not sign-up

Date: 2026-09-14

## Status

Accepted

Supersedes [ADR 0002](./0002-first-admin-requires-verification.md) on where the Verification email is triggered and on cooldown storage.

## Context

`better-auth` was configured with `sendOnSignUp: true`, so `Setup` sign-up sent the Verification email. The other entry point, sign-in failing with `EMAIL_NOT_VERIFIED` on `/admin/login`, navigated to `/admin/verify-email` without sending anything, yet that page always claimed the email had been sent and locked its resend control for 60 seconds. The page could not tell the two arrivals apart, and the cooldown reset on every refresh.

Alternatives considered:

- **Keep `sendOnSignUp: true`, pass a `sent` search param:** two send sites and a search-schema property just to keep copy honest — rejected as unnecessary state.
- **Send from the caller before navigating:** the copy would still have to reconcile a failed send, and `Setup` and login would duplicate the logic.
- **Auto-send on mount with `sendOnSignUp: false`:** one send site, both entries behave identically.

## Decision

Remove `sendOnSignUp` so no Verification email is sent during `Setup` sign-up. `/admin/verify-email` sends once on mount when no unexpired cooldown is stored for the tab; a successful send writes a 60-second expiry to `sessionStorage` under a single per-tab key, so refresh within the window keeps the cooldown without re-sending. A failed send leaves the page retryable and keeps the unsent copy; the `sent` copy variants (`admin.setup.success.*` in both `en`/`id`) are only shown after a successful send. `better-auth` rate-limits `/send-verification-email` to 3 requests per 60 seconds per client, with the page cooldown as the first line of defense.

## Consequences

- One send site: both `Setup` and the `/admin/login` `EMAIL_NOT_VERIFIED` path reach `/admin/verify-email` and get exactly one Verification email per mount.
- Refresh within the cooldown does not re-send; refresh after the cooldown expires re-sends, because auto-send runs on every mount without an unexpired cooldown.
- `/admin/setup` sign-up no longer sends; if the auto-send on `/admin/verify-email` fails, the retry control on that page is the only path.
- The cooldown lives in `sessionStorage`, so it is per-tab and dies with the tab; `Session` (authentication) is unaffected and still only valid after Verification.
- The cooldown is one key per tab, so a second unverified account reached in the same tab within the 60-second window shares it: its auto-send is skipped until the window expires, and the manual Resend control is the fallback.
- `/admin/verify-email` is client-rendered (`ssr: false`) so its first paint can seed the cooldown state from `sessionStorage`; the route has no server-rendered HTML.
- ADR 0002's "in-place pending Card on `/admin/setup`, no storage" describes an earlier shape; the `/admin/verify-email` route and its storage-backed cooldown are the current flow.

## References

- Glossary: `CONTEXT.md` (`User`, `Session`, `Verification`, `Role`, `Setup`)
- Code: `packages/backend/src/modules/auth/index.ts`, `packages/web/src/routes/admin/verify-email.tsx`, `packages/web/src/routes/admin/setup.tsx`, `packages/web/src/routes/admin/login.tsx`
