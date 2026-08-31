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
An active authenticated period for a User, identified by a token with expiry and optional impersonation.
_Avoid_: Token, Login

**Verification**:
A time-bound proof used to confirm an identifier or action.
_Avoid_: OTP, Challenge, Code

**Role**:
A comma-separated capability label on a User (e.g. `admin`).
_Avoid_: Permission, Group, Privilege

### Content

**Article**:
A publishable content item that may belong to a Category and carries translatable fields.
_Avoid_: Post, Page, Entry, Content

**Category**:
An optional grouping for Articles (one-to-many); an Article may exist without a Category.
_Avoid_: ArticleCategory, Topic, Section, Tag

**ArticleTranslation**:
Per-Locale localized fields for an Article: title, slug, excerpt, content, metaTitle, metaDescription.
_Avoid_: Translation, LocalizedArticle

**CategoryTranslation**:
Per-Locale localized fields for a Category: name, slug, description.
_Avoid_: Translation, LocalizedCategory

**Status**:
Lifecycle of an Article: `draft`, `published`, or `archived`.
_Avoid_: State, Stage

**Slug**:
A URL-friendly, per-Locale identifier derived via slugify and unique within its Locale.
_Avoid_: Permalink, Path, Handle

**Locale**:
A supported language/region code (e.g. `en`) that scopes all translations.
_Avoid_: Language, Lang
