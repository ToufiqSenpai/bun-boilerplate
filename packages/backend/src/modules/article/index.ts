import { Elysia } from "elysia"

import { database } from "../../common/database.js"
import { notFoundSchema } from "../../common/error.js"
import { localePlugin } from "../../common/i18n.js"
import type { OpenApiTag } from "../../common/openapi.js"
import { authPlugin } from "../auth/index.js"
import {
  articleCategorySchema,
  articleCategoryTranslationParamsSchema,
  createArticleCategorySchema,
  deleteArticleCategoryNoContentSchema,
  deleteArticleCategoryParamsSchema,
  listArticleCategoriesHeadersSchema,
  listArticleCategoriesQuerySchema,
  listArticleCategoryResponseSchema,
  upsertArticleCategoryTranslationSchema
} from "./schemas/article-category.schema.js"
import { ArticleCategoryService } from "./services/article-category.service.js"

const articleCategoryService = new ArticleCategoryService(database)

export const articleTags: OpenApiTag[] = [
  { name: "Article", description: "Article categories and their per-locale translations" }
]

export const articlePlugin = new Elysia({ name: "article", tags: ["Article"] })
  .use(authPlugin)
  .use(localePlugin)
  .get(
    "/article-categories",
    ({ query, locale, set }) => {
      set.headers["content-language"] = locale
      return articleCategoryService.list(query, locale)
    },
    {
      headers: listArticleCategoriesHeadersSchema,
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
  .post(
    "/article-categories",
    async ({ body, set, status }) => {
      set.headers["content-language"] = body.locale
      return status(201, await articleCategoryService.create(body))
    },
    {
      admin: true,
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
      admin: true,
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
      admin: true,
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
