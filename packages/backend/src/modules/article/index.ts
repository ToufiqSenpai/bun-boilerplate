import { Elysia } from "elysia"

import { database } from "../../common/database.js"
import { conflictSchema, notFoundSchema } from "../../common/error.js"
import { localeHeadersSchema, localePlugin } from "../../common/i18n.js"
import type { OpenApiTag } from "../../common/openapi.js"
import { storage } from "../../common/storage/storage.js"
import { authPlugin, auth } from "../auth/index.js"
import { isKnownRole } from "../auth/permissions.js"
import {
  articleCategorySchema,
  articleCategoryTranslationParamsSchema,
  createArticleCategorySchema,
  deleteArticleCategoryNoContentSchema,
  deleteArticleCategoryParamsSchema,
  getArticleCategoryParamsSchema,
  listArticleCategoriesQuerySchema,
  listArticleCategoryResponseSchema,
  upsertArticleCategoryTranslationSchema
} from "./schemas/article-category.schema.js"
import {
  articleSchema,
  articleTranslationParamsSchema,
  createArticleSchema,
  deleteArticleNoContentSchema,
  deleteArticleParamsSchema,
  getArticleParamsSchema,
  listArticlesQuerySchema,
  listArticlesResponseSchema,
  updateArticleParamsSchema,
  updateArticleResponseSchema,
  updateArticleSchema,
  upsertArticleTranslationSchema
} from "./schemas/article.schema.js"
import { ArticleCategoryService } from "./services/article-category.service.js"
import { ArticleService } from "./services/article.service.js"

const articleCategoryService = new ArticleCategoryService(database)
const articleService = new ArticleService(database, storage)

export const articleTags: OpenApiTag[] = [
  { name: "Article", description: "Articles, article categories, and their per-locale translations" }
]

export const articlePlugin = new Elysia({ name: "article", tags: ["Article"] })
  .use(authPlugin)
  .use(localePlugin)
  // Mirrors the permissions macro's gates (verified session, known role) without rejecting:
  // known roles are exactly admin and superadmin, the only viewers allowed past published-only reads.
  .resolve(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    const role = session?.user.role
    return {
      canViewUnpublished: !!session?.user.emailVerified && !!role && isKnownRole(role)
    }
  })
  .get(
    "/articles",
    ({ query, locale, set, canViewUnpublished }) => {
      set.headers["content-language"] = locale
      return articleService.list(query, locale, canViewUnpublished)
    },
    {
      headers: localeHeadersSchema,
      query: listArticlesQuerySchema,
      response: listArticlesResponseSchema.describe(
        "Page of articles translated into the requested locale, with pagination metadata"
      ),
      detail: {
        summary: "List articles",
        description:
          "Returns a paginated list of articles, each translated into the requested locale. The translation is matched exactly against the negotiated locale; articles without a translation in that locale are omitted. The status filter defaults to published and only takes effect for verified admin or superadmin sessions; all other viewers are forced to published. CoverImage and NodeImage storage keys are resolved to host URLs."
      }
    }
  )
  .get(
    "/articles/:identifier",
    ({ params, locale, set, canViewUnpublished }) => {
      set.headers["content-language"] = locale
      return articleService.getByIdentifier(params.identifier, locale, canViewUnpublished)
    },
    {
      headers: localeHeadersSchema,
      params: getArticleParamsSchema,
      response: {
        200: articleSchema.describe("The article translated into the requested locale"),
        404: notFoundSchema.describe(
          "No article visible to the caller exists with the given identifier, or no translation exists for the resolved locale"
        )
      },
      detail: {
        summary: "Get article by id or slug",
        description:
          "Resolves an article by its stable uuidv7 id or by its slug in the requested locale. The locale is negotiated from the `X-Locale` header first, then `Accept-Language`, then the application default. Non-published articles resolve only for verified admin or superadmin sessions; every other caller receives the same 404 as for a missing article, with no indication of existence. Returns 404 when the article does not exist, is not visible to the caller, or has no translation in the resolved locale; no fallback translation is served. A valid uuidv7 identifier is always treated as an id. Slugs are unique per locale, so the same slug may exist under different locales. CoverImage and NodeImage storage keys are resolved to host URLs."
      }
    }
  )
  .post(
    "/articles",
    async ({ body, request, set, status }) => {
      set.headers["content-language"] = body.locale
      return status(201, await articleService.create(body, request.signal))
    },
    {
      permissions: { article: ["create"] },
      body: createArticleSchema.describe(
        "Article fields with the first translation, content document, and image files"
      ),
      response: {
        201: articleSchema.describe("The created article with its first translation"),
        404: notFoundSchema.describe("The given categoryId does not reference an existing article category"),
        409: conflictSchema.describe("The slug already exists for the requested locale")
      },
      detail: {
        summary: "Create an article",
        description:
          "Admin only. Creates a new article together with its first translation, TipTap content document, mandatory cover image, and inline images matched to upload references in the document."
      }
    }
  )
  .put(
    "/articles/:id/translations/:locale",
    async ({ params, body, request, set, status }) => {
      set.headers["content-language"] = params.locale
      const { translation, created } = await articleService.upsertTranslation(params, body, request.signal)
      return status(created ? 201 : 200, translation)
    },
    {
      permissions: { article: ["update"] },
      params: articleTranslationParamsSchema,
      body: upsertArticleTranslationSchema.describe(
        "ArticleTranslation fields with ArticleContent document and NodeImage files"
      ),
      response: {
        200: articleSchema.describe("The article with the replaced translation"),
        201: articleSchema.describe("The article with the newly created translation"),
        404: notFoundSchema.describe("No article exists with the given id"),
        409: conflictSchema.describe("The slug already exists for the requested locale")
      },
      detail: {
        summary: "Create or replace an article translation",
        description:
          "Admin only. Upserts the ArticleTranslation of an existing Article for the given Locale, replacing text fields, the ArticleContent document, and NodeImage entries wholesale. Never touches the CoverImage. Returns 201 when the translation was created and 200 when an existing one was replaced."
      }
    }
  )
  .patch(
    "/articles/:id",
    async ({ params, body, request, status }) => {
      return status(200, await articleService.updateArticle(params, body, request.signal))
    },
    {
      permissions: { article: ["update"] },
      params: updateArticleParamsSchema,
      body: updateArticleSchema.describe("Article-level fields to change: lifecycle status, category, or cover"),
      response: {
        200: updateArticleResponseSchema.describe(
          "The updated article-level fields with the CoverImage resolved to its host URL"
        ),
        404: notFoundSchema.describe(
          "No article exists with the given id, or the given categoryId does not reference an existing article category"
        )
      },
      detail: {
        summary: "Update an article's status, category, or cover",
        description:
          "Admin only. Updates article-level fields without touching any translation: lifecycle Status, ArticleCategory reassignment (null unsets it), and optional CoverImage replacement. An absent cover part keeps the stored cover; a supplied one uploads under a fresh key and deletes the superseded key. publishedAt is set when the status first becomes published and is never cleared. Translation payloads are rejected as validation errors."
      }
    }
  )
  .delete(
    "/articles/:id",
    async ({ params, status }) => {
      await articleService.delete(params)
      return status(204, undefined)
    },
    {
      permissions: { article: ["delete"] },
      params: deleteArticleParamsSchema,
      response: {
        204: deleteArticleNoContentSchema,
        404: notFoundSchema.describe("No article exists with the given id")
      },
      detail: {
        summary: "Delete an article",
        description:
          "Admin only. Permanently removes the article, all of its translations, and every storage key referenced by its CoverImage and NodeImage entries. Returns 204 with no response body. A deleted identifier resolves as not-found on subsequent reads."
      }
    }
  )
  .get(
    "/article-categories",
    ({ query, locale, set }) => {
      set.headers["content-language"] = locale
      return articleCategoryService.list(query, locale)
    },
    {
      headers: localeHeadersSchema,
      query: listArticleCategoriesQuerySchema,
      response: listArticleCategoryResponseSchema.describe(
        "Page of article categories translated into the requested locale, with pagination metadata"
      ),
      detail: {
        summary: "List article categories",
        description:
          "Returns a paginated list of article categories, each translated into the requested locale. The translation is matched exactly against the `locale` query parameter; categories without a translation in that locale are omitted."
      }
    }
  )
  .get(
    "/article-categories/:identifier",
    ({ params, locale, set }) => {
      set.headers["content-language"] = locale
      return articleCategoryService.getByIdentifier(params.identifier, locale)
    },
    {
      headers: localeHeadersSchema,
      params: getArticleCategoryParamsSchema,
      response: {
        200: articleCategorySchema.describe("The article category translated into the requested locale"),
        404: notFoundSchema.describe(
          "No article category exists with the given identifier, or no translation exists for the resolved locale"
        )
      },
      detail: {
        summary: "Get article category by id or slug",
        description:
          "Resolves an article category by its stable uuidv7 id or by its slug in the requested locale. The locale is negotiated from the `X-Locale` header first, then `Accept-Language`, then the application default. Returns 404 when the category does not exist or when it has no translation in the resolved locale; no fallback translation is served. A valid uuidv7 identifier is always treated as an id. Slugs are unique per locale, so the same slug may exist under different locales."
      }
    }
  )
  .post(
    "/article-categories",
    async ({ body, set, status }) => {
      set.headers["content-language"] = body.locale
      return status(201, await articleCategoryService.create(body))
    },
    {
      permissions: { articleCategory: ["create"] },
      body: createArticleCategorySchema.describe("Category fields including the first translation"),
      response: {
        201: articleCategorySchema.describe("The created article category with its first translation"),
        409: conflictSchema.describe("The slug already exists for the requested locale")
      },
      detail: {
        summary: "Create an article category",
        description:
          "Admin only. Creates a new article category together with its first translation in the given locale. The slug is slugified before being stored and must be unique per locale."
      }
    }
  )
  .put(
    "/article-categories/:id/translations/:locale",
    async ({ params, body, set, status }) => {
      set.headers["content-language"] = params.locale
      const { translation, created } = await articleCategoryService.upsertTranslation(params, body)
      return status(created ? 201 : 200, translation)
    },
    {
      permissions: { articleCategory: ["update"] },
      params: articleCategoryTranslationParamsSchema,
      body: upsertArticleCategoryTranslationSchema.describe("Translation fields for the locale in the path"),
      response: {
        200: articleCategorySchema.describe("The article category with the replaced translation"),
        201: articleCategorySchema.describe("The article category with the newly created translation"),
        404: notFoundSchema.describe("No article category exists with the given id"),
        409: conflictSchema.describe("The slug already exists for the requested locale")
      },
      detail: {
        summary: "Create or replace a category translation",
        description:
          "Admin only. Upserts the translation of an existing article category for the given locale. Returns 201 when the translation was created and 200 when an existing one was replaced."
      }
    }
  )
  .delete(
    "/article-categories/:id",
    async ({ params, status }) => {
      await articleCategoryService.delete(params)
      return status(204, undefined)
    },
    {
      permissions: { articleCategory: ["delete"] },
      params: deleteArticleCategoryParamsSchema,
      response: {
        204: deleteArticleCategoryNoContentSchema,
        404: notFoundSchema.describe("No article category exists with the given id")
      },
      detail: {
        summary: "Delete an article category",
        description:
          "Admin only. Permanently removes the article category and all of its translations. Articles that referenced the category keep existing but their category becomes unset. Returns 204 with no response body."
      }
    }
  )
