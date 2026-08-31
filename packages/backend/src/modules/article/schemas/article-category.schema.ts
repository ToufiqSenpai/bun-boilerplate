import { DEFAULT_LOCALE, LOCALES } from "@bun-boilerplate/i18n"
import slugify from "@sindresorhus/slugify"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { database } from "../../../common/database.js"
import { localeHeadersSchema } from "../../../common/i18n.js"
import { collectionSchema } from "../../../common/schema.js"
import { paginatedSchema, paginationQuerySchema } from "../../../helpers/pagination.js"
import { articleCategoryTranslations } from "../tables/article-category.table.js"

// Shared field schemas
const slugSchema = z
  .string({ error: "Slug must be a string" })
  .min(1, { error: "Slug must not be empty" })
  .max(255, { error: "Slug must be at most 255 characters" })
  .transform(value => slugify(value))
  .refine(slug => slug.length > 0, { error: "Slug must not be empty" })
  .describe("URL-friendly slug, slugified before stored")

// Base schema: shape of an article category as returned in responses
export const articleCategorySchema = z
  .object({
    locale: z
      .enum(LOCALES, { error: "Invalid locale" })
      .default(DEFAULT_LOCALE)
      .describe("Locale for the category translation"),
    name: z
      .string({ error: "Name is required" })
      .min(1, { error: "Name must not be empty" })
      .max(255, { error: "Name must be at most 255 characters" })
      .describe("Display name of the category"),
    slug: slugSchema,
    description: z
      .string({ error: "Description must be a string" })
      .max(1000, { error: "Description must be at most 1000 characters" })
      .optional()
      .describe("Optional description of the category")
  })
  .extend(collectionSchema.shape)

// POST /article-categories (body) — slug uniqueness is per locale, matching the UNIQUE(locale, slug) constraint
export const createArticleCategorySchema = articleCategorySchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine(
    async ({ locale, slug }) => {
      const [exists] = await database
        .select({ slug: articleCategoryTranslations.slug })
        .from(articleCategoryTranslations)
        .where(and(eq(articleCategoryTranslations.locale, locale), eq(articleCategoryTranslations.slug, slug)))
        .limit(1)
      return !exists
    },
    { error: "Slug already exists", path: ["slug"] }
  )

// GET /article-categories (query + headers)
export const listArticleCategoriesQuerySchema = paginationQuerySchema
export const listArticleCategoriesHeadersSchema = localeHeadersSchema
export const listArticleCategoryResponseSchema = paginatedSchema(articleCategorySchema)

// PUT /article-categories/:id/translations/:locale (params + body) — uniqueness needs params.id, checked in the service
export const articleCategoryTranslationParamsSchema = z.object({
  id: z.uuidv7({ error: "Invalid category id" }).describe("Article category id"),
  locale: z.enum(LOCALES, { error: "Invalid locale" }).describe("Locale of the translation to create or replace")
})
export const upsertArticleCategoryTranslationSchema = articleCategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  locale: true
})

// Derived types (outputs of the schemas above)
export type ArticleCategory = z.output<typeof articleCategorySchema>
export type CreateArticleCategoryBody = z.output<typeof createArticleCategorySchema>
export type ListArticleCategoriesQuery = z.output<typeof listArticleCategoriesQuerySchema>
export type ArticleCategoryTranslationParams = z.output<typeof articleCategoryTranslationParamsSchema>
export type UpsertArticleCategoryTranslationBody = z.output<typeof upsertArticleCategoryTranslationSchema>
