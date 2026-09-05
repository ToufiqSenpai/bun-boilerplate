import { DEFAULT_LOCALE, LOCALES } from "@bun-boilerplate/i18n"
import slugify from "@sindresorhus/slugify"
import { z } from "zod"

import { localeHeadersSchema } from "../../../common/i18n.js"
import { collectionSchema, omitCollection } from "../../../common/schema.js"
import { paginatedSchema, paginationQuerySchema } from "../../../helpers/pagination.js"

// Shared field schemas
const slugSchema = z
  .string({ error: "Slug must be a string" })
  .min(1, { error: "Slug must not be empty" })
  .max(255, { error: "Slug must be at most 255 characters" })
  .transform(value => slugify(value))
  .refine(slug => slug.length > 0, { error: "Slug must not be empty" })
  .refine(slug => !z.uuidv7().safeParse(slug).success, { error: "Slug must not look like a category id" })
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

export type ArticleCategory = z.output<typeof articleCategorySchema>

// GET /article-categories (query + headers)
export const listArticleCategoriesQuerySchema = paginationQuerySchema
export const listArticleCategoriesHeadersSchema = localeHeadersSchema
export const listArticleCategoryResponseSchema = paginatedSchema(articleCategorySchema)

export type ListArticleCategoriesQuery = z.output<typeof listArticleCategoriesQuerySchema>

// GET /article-categories/:identifier (params + headers) — resolves an ArticleCategory by uuidv7 id or per-locale Slug.
// The uuidv7 branch is tried first, so an identifier that looks like an id is always treated as an id, never as a Slug.
export const getArticleCategoryParamsSchema = z.object({
  identifier: z
    .union([z.uuidv7(), slugSchema], { error: "Invalid identifier" })
    .describe("Article category id (uuidv7) or slug in the requested locale")
})
export const getArticleCategoryHeadersSchema = localeHeadersSchema

// POST /article-categories (body) — pure rules only; per-Locale Slug uniqueness is owned by the
// article category service through the UNIQUE(locale, slug) constraint (23505 → 422 Slug-conflict)
export const createArticleCategorySchema = omitCollection(articleCategorySchema)

export type CreateArticleCategoryBody = z.output<typeof createArticleCategorySchema>

// PUT /article-categories/:id/translations/:locale (params + body) — uniqueness needs params.id, checked in the service
export const articleCategoryTranslationParamsSchema = z.object({
  id: z.uuidv7({ error: "Invalid category id" }).describe("Article category id"),
  locale: z.enum(LOCALES, { error: "Invalid locale" }).describe("Locale of the translation to create or replace")
})
export const upsertArticleCategoryTranslationSchema = omitCollection(articleCategorySchema).omit({ locale: true })

export type ArticleCategoryTranslationParams = z.output<typeof articleCategoryTranslationParamsSchema>
export type UpsertArticleCategoryTranslationBody = z.output<typeof upsertArticleCategoryTranslationSchema>

// DELETE /article-categories/:id (params + 204 response) — status code without a response body
export const deleteArticleCategoryParamsSchema = z.object({
  id: z.uuidv7({ error: "Invalid category id" }).describe("Article category id")
})
export const deleteArticleCategoryNoContentSchema = z.undefined().describe("Empty response body on successful deletion")

export type DeleteArticleCategoryParams = z.output<typeof deleteArticleCategoryParamsSchema>
