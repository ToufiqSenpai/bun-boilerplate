import { Elysia } from "elysia"

import { database } from "../../common/database.js"
import { localePlugin } from "../../common/i18n.js"
import { authPlugin } from "../auth/index.js"
import {
  articleCategorySchema,
  articleCategoryTranslationParamsSchema,
  createArticleCategorySchema,
  listArticleCategoriesHeadersSchema,
  listArticleCategoriesQuerySchema,
  listArticleCategoryResponseSchema,
  upsertArticleCategoryTranslationSchema
} from "./schemas/article-category.schema.js"
import { ArticleCategoryService } from "./services/article-category.service.js"

export const articlePlugin = new Elysia({ name: "article" })
  .use(authPlugin)
  .use(localePlugin)
  .resolve(() => ({ articleCategoryService: new ArticleCategoryService(database) }))
  .get(
    "/article-categories",
    ({ query, locale, set, articleCategoryService }) => {
      set.headers["content-language"] = locale
      return articleCategoryService.list(query, locale)
    },
    {
      headers: listArticleCategoriesHeadersSchema,
      query: listArticleCategoriesQuerySchema,
      response: listArticleCategoryResponseSchema
    }
  )
  .post(
    "/article-categories",
    async ({ body, set, status, articleCategoryService }) => {
      set.headers["content-language"] = body.locale
      return status(201, await articleCategoryService.create(body))
    },
    {
      admin: true,
      body: createArticleCategorySchema,
      response: {
        201: articleCategorySchema
      }
    }
  )
  .put(
    "/article-categories/:id/translations/:locale",
    async ({ params, body, set, status, articleCategoryService }) => {
      set.headers["content-language"] = params.locale
      const { translation, created } = await articleCategoryService.upsertTranslation(params, body)
      return status(created ? 201 : 200, translation)
    },
    {
      admin: true,
      params: articleCategoryTranslationParamsSchema,
      body: upsertArticleCategoryTranslationSchema,
      response: {
        200: articleCategorySchema,
        201: articleCategorySchema
      }
    }
  )
