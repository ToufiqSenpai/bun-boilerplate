# Static role-based access control

Date: 2026-09-03

## Status

Accepted

## Context

Every protected endpoint was gated by a hardcoded `admin` string match (`hasRole` comma-split helper plus an `admin`-only Elysia macro). There was no notion of a `Permission` (a resource-action grant), no way to distinguish a system owner from a content manager, and no single place where the `Role`-to-`Permission` matrix lived (`packages/backend/src/modules/auth/utils/role.ts`, macro `admin` in `packages/backend/src/modules/auth/index.ts:228-234`).

Alternatives considered:

- **Organization plugin with dynamic access control:** runtime-created roles per organization. Rejected: the boilerplate needs exactly three fixed tiers, and dynamic machinery adds schema, UI, and operational surface no consumer asked for (see Out of Scope, issue #20).
- **Keep per-role string checks:** each new write endpoint would need another bespoke check, repeating the status-quo drift.
- **Static access control via the better-auth admin plugin model:** one access controller statement plus three static `Role`s (`superadmin`, `admin`, `user`), enforced by a single generic `requirePermission` macro that evaluates the plugin's server-side permission check. Chosen: matches the official plugin model, one matrix in code, backend remains the single source of truth.

## Decision

Define the matrix once in `packages/backend/src/modules/auth/permissions.ts`: an `articleCategory` resource (`create`, `update`, `delete`) merged with the admin plugin's default `user`/`session` statements. `superadmin` holds the default administrative statements plus full `articleCategory` rights (without `impersonate-admins`: cross-admin impersonation stays out of scope); `admin` holds full `articleCategory` rights and no `user`/`session` rights; `user` holds nothing. Pass `ac` + `roles` to `admin()` with no `adminRoles` allowlist, so granted `Permission`s alone govern access. The first-`User` auto-promotion now assigns `superadmin` instead of `admin`; the Verification-before-Session contract (ADR-0002) is unchanged. A generic `requirePermission` macro (single named macro: session gate, unknown-role fail-closed `403`, then `auth.api.userHasPermission`) replaces the hardcoded `admin` macro; the three article-category write routes declare their required `Permission`, public reads are untouched. Backend only: no admin client plugin on web, no runtime role creation, no last-superadmin safeguard (accepted, documented risk).

## Consequences

- Endpoint authorization is `Role`-based and data-driven: adding a future resource touches the statement and the `PermissionRequirement` interface in `permissions.ts`, plus one macro property per route.
- Unknown or missing `Role` values fail closed with `403`; demotion takes effect on the very next request (no cookie-cache staleness: cookie cache is not enabled).
- Glossary updated: `Role` is a static label (no longer comma-separated), `Setup` creates the first `User` with `Role` `superadmin` (see `CONTEXT.md` `Role`/`Setup`/`Permission`).
- The retired `hasRole` helper's test file is replaced by `packages/backend/src/modules/auth/index.test.ts` covering the static matrix plus unknown-role rejection; HTTP behavior stays covered by the existing end-to-end suites.

## References

- Spec: GitHub issue #20 (`ToufiqSenpai/bun-boilerplate`)
- Glossary: `CONTEXT.md` (`User`, `Session`, `Verification`, `Role`, `Permission`, `Setup`)
- Research: `docs/research/better-auth-rbac.md`
- Prior ADR: `docs/adr/0002-first-admin-requires-verification.md`
- Code: `packages/backend/src/modules/auth/permissions.ts`, `packages/backend/src/modules/auth/index.ts`, `packages/backend/src/modules/article/index.ts`
