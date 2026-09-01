# Single `:identifier` route for fetching an ArticleCategory by id or Slug

Date: 2026-09-01

## Status

Accepted

## Context

The Content API needs a canonical, cacheable detail endpoint for a single `ArticleCategory` with its `ArticleCategoryTranslation` in the requested `Locale`. Clients reference categories two ways: internal tooling holds the stable `uuidv7` `id`; public URLs want a human-friendly per-`Locale` `Slug`. We had to choose the URL contract before any consumer existed, because endpoints are hard to reverse once clients depend on them.

Alternatives considered:

- **Two routes** (`GET /article-categories/:id` and `GET /article-categories/:slug`): more explicit, but the same resource would have two canonical URLs, clients must decide which to build, and route shadowing between sibling dynamic segments becomes a permanent hazard.
- **Query parameters** (`?id=` / `?slug=`): keeps paths static but leaks resolution logic out of the URL and produces ugly public category URLs.

## Decision

One public endpoint, `GET /article-categories/:identifier`, that resolves either form:

- The `:identifier` path param is validated as `uuidv7` **or** a slugified string (max 255). A valid `uuidv7` is **always** treated as the `id`, never as a `Slug` — an `id` that could double as a `Slug` would make resolution order significant.
- `Slug` is written by a `refine` that rejects `uuidv7`-shaped values on the create and translation-upsert paths, so the ambiguity can never enter the data.
- `Locale` comes from request headers (`X-Locale` > `Accept-Language` > `DEFAULT_LOCALE`), identical to the list endpoint; the response echoes the resolved `Locale` in `Content-Language`.
- Resolution branches in application code into two indexed queries — primary key by `id`, `UNIQUE(locale, slug)` by `Slug` — instead of one SQL `OR` that defeats both indexes.
- `404` when the `ArticleCategory` does not exist, and also when it exists but has no `ArticleCategoryTranslation` for the resolved `Locale` (no silent fallback to another `Locale`). The `id` path distinguishes the two cases with a cheap primary-key existence probe run only on miss; the `Slug` path returns the generic message because a cross-`Locale` lookup would cost more than it informs.

## Consequences

- `id` is the stable canonical identifier; `Slug` is mutable via the translation upsert and has **no slug history or redirects**. Changing a `Slug` immediately breaks the old public URL; consumers needing stable links must store the `id`, and redirect strategy is the caller's responsibility.
- `Slug` uniqueness is per-`Locale` (`UNIQUE(locale, slug)`), which is surprising for readers used to global slugs: the same `Slug` can exist under `en` and `id` for different categories.
- One route, one response shape (`articleCategorySchema`, not paginated), so Eden treaty clients get a single typed method for both identifier kinds.
- Known tooling friction: Eden (treaty v1) intersects the params of sibling dynamic routes (`:id`, `:identifier`) under one path segment, which erases typed method access on that segment. `packages/backend/test/article-category.e2e.ts` restores the correct proxy variant behind `categoryById` / `categoryByIdentifier` helpers with a single documented `as never` cast. Prefer migrating to a client generator without this limitation over restructuring the routes.

## References

- Spec: GitHub issue #8 (`ToufiqSenpai/bun-boilerplate`)
- Glossary: `CONTEXT.md` (`ArticleCategory`, `ArticleCategoryTranslation`, `Slug`, `Locale`)
