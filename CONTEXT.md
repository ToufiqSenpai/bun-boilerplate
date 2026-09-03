# bun-boilerplate

Reusable project template built on Bun, Elysia, Drizzle, better-auth, and TanStack Router. Provides foundational Identity and Content capabilities for forking teams to extend.

## Language

### Identity

**User**:
A person who can authenticate in the system.
_Avoid_: Account, Member, Customer

**Account**:
A provider linkage for a User (e.g. OAuth provider, password credential) storing providerId and tokens.
_Avoid_: ProviderAccount, OAuthAccount, Connection

**Session**:
An active authenticated period for a User, identified by a token with expiry and optional impersonation. A `Session` is only valid after `Verification` is complete (`emailVerified`), enforced in the `auth` macro; no `Session` is created on `signUp` alone when `requireEmailVerification` is true.
_Avoid_: Token, Login

**Verification**:
A time-bound proof used to confirm an identifier or action. Every `User` including the first `User` with `Role` `admin` must complete `Verification` before a `Session` is established; no auto-verified bypass.
_Avoid_: OTP, Challenge, Code

**Role**:
A comma-separated capability label on a User (e.g. `superadmin`, `admin`).
_Avoid_: Group, Privilege

**Permission**:
A resource-action grant checked against a Role (e.g. `articleCategory:create`).
_Avoid_: Privilege

**Setup**:
The one-time initialization that creates the first `User` with `Role` `admin` via `/admin/setup`. `Setup` succeeds only after `Verification` is completed, not on `signUp` alone.
_Avoid_: Onboarding, Bootstrap, Install

### Content

**Article**:
A publishable content item that may belong to an ArticleCategory and carries translatable fields.
_Avoid_: Post, Page, Entry, Content

**ArticleCategory**:
An optional grouping for Articles (one-to-many); an Article may exist without an ArticleCategory.
_Avoid_: Category, Topic, Section, Tag

**ArticleTranslation**:
Per-Locale localized fields for an Article: title, slug, excerpt, content, metaTitle, metaDescription.
_Avoid_: Translation, LocalizedArticle

**ArticleCategoryTranslation**:
Per-Locale localized fields for an ArticleCategory: name, slug, description.
_Avoid_: CategoryTranslation, Translation, LocalizedCategory

**Status**:
Lifecycle of an Article: `draft`, `published`, or `archived`.
_Avoid_: State, Stage

**Slug**:
A URL-friendly, per-Locale identifier derived via slugify and unique within its Locale.
_Avoid_: Permalink, Path, Handle

**Locale**:
A supported language/region code (e.g. `en`) that scopes all translations.
_Avoid_: Language, Lang

### Health

**Liveness**:
Whether the backend process itself is responsive, probed at `GET /health/live` which answers `200 {"status":"alive"}` without consulting any dependency.
_Avoid_: Readiness, Healthcheck

**Readiness**:
Whether the backend can serve traffic right now, probed at `GET /health/ready` which runs every registered `Check` in parallel under a per-check deadline and answers `200 {"status":"ready"}` or `503 {"status":"unavailable"}`.
_Avoid_: Liveness, Healthcheck

**Check**:
An object implementing the `HealthCheck` interface (`name` plus an async `check()` predicate) listed in the health plugin's `healthChecks` registry; resolving `true` means pass, while rejecting, resolving `false`, or exceeding the deadline means fail. The built-in `Check` is `DatabaseCheck`, the database round-trip.
_Avoid_: Probe, Ping, Healthcheck
