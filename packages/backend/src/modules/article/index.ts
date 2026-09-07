import { Elysia } from "elysia"

import { database } from "../../common/database.js"
import { notFoundSchema } from "../../common/error.js"
import { localeHeadersSchema, localePlugin } from "../../common/i18n.js"
import type { OpenApiTag } from "../../common/openapi.js"
import { authPlugin } from "../auth/index.js"
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
  getArticleParamsSchema,
  listArticlesQuerySchema,
  listArticlesResponseSchema
} from "./schemas/article.schema.js"
import { ArticleCategoryService } from "./services/article-category.service.js"
import { ArticleService } from "./services/article.service.js"

const articleCategoryService = new ArticleCategoryService(database)
const articleService = new ArticleService(database)

export const articleTags: OpenApiTag[] = [
  { name: "Article", description: "Articles, article categories, and their per-locale translations" }
]

export const articlePlugin = new Elysia({ name: "article", tags: ["Article"] })
  .use(authPlugin)
  .use(localePlugin)
  .get(
    "/articles",
    ({ query, locale, set }) => {
      set.headers["content-language"] = locale
      return articleService.list(query, locale)
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
          "Returns a paginated list of articles, each translated into the requested locale. The translation is matched exactly against the negotiated locale; articles without a translation in that locale are omitted. Filter by status defaults to published. CoverImage and NodeImage storage keys are resolved to host URLs."
      }
    }
  )
  .get(
    "/articles/:identifier",
    ({ params, locale, set }) => {
      set.headers["content-language"] = locale
      return articleService.getByIdentifier(params.identifier, locale)
    },
    {
      headers: localeHeadersSchema,
      params: getArticleParamsSchema,
      response: {
        200: articleSchema.describe("The published article translated into the requested locale"),
        404: notFoundSchema.describe(
          "No published article exists with the given identifier, or no translation exists for the resolved locale"
        )
      },
      detail: {
        summary: "Get article by id or slug",
        description:
          "Resolves a published article by its stable uuidv7 id or by its slug in the requested locale. The locale is negotiated from the `X-Locale` header first, then `Accept-Language`, then the application default. Returns 404 when the article does not exist, is not published, or has no translation in the resolved locale; no fallback translation is served. A valid uuidv7 identifier is always treated as an id. Slugs are unique per locale, so the same slug may exist under different locales. CoverImage and NodeImage storage keys are resolved to host URLs."
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
        201: articleCategorySchema.describe("The created article category with its first translation")
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
        404: notFoundSchema.describe("No article category exists with the given id")
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
