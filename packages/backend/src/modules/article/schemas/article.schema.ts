import { COMMON_IMAGE_MIMETYPE } from "@bun-boilerplate/constants"
import { DEFAULT_LOCALE, LOCALES } from "@bun-boilerplate/i18n"
import { richTextContentSchema } from "@bun-boilerplate/richtext"
import { z } from "zod"

import { collectionSchema, fileSchema, jsonStringSchema, omitCollection, slugSchema, timestampSchema } from "../../../common/schema.js"
import { paginatedSchema, paginationQuerySchema } from "../../../helpers/pagination.js"
import { articleStatusEnum } from "../tables/article.table.js"

const articleImage = fileSchema
  .refine(async ({ mime }) => COMMON_IMAGE_MIMETYPE.includes(mime), {
    error: `Cover image mimetype must be ${COMMON_IMAGE_MIMETYPE.join(", ")}.`
  })

export const articleSchema = z
  .object({
    status: z
      .enum(articleStatusEnum.enumValues)
      .default("draft")
      .describe("Lifecycle status of the article"),
    publishedAt: timestampSchema.nullable().readonly().describe("Publication timestamp, null when never published"),
    categoryId: z
      .uuidv7({ error: "Category id must be UUIDv7" })
      .nullable()
      .describe("Article category id, null when uncategorised"),
    locale: z
      .enum(LOCALES, { error: "Invalid locale" })
      .default(DEFAULT_LOCALE)
      .describe("Locale of the translation carried by this row"),
    title: z
      .string({ error: "Title is required" })
      .min(1, { error: "Title must not be empty" })
      .max(255, { error: "Title must be at most 255 characters" })
      .describe("Translated title"),
    slug: slugSchema.describe("Translated slug"),
    excerpt: z
      .string({ error: "Excerpt is required" })
      .min(1, { error: "Excerpt must not be empty" })
      .max(1000, { error: "Excerpt must be at most 1000 characters" })
      .describe("Translated excerpt"),
    content: richTextContentSchema.describe("Rich text document with image references resolved to host URLs"),
    metaTitle: z
      .string({ error: "Meta title is required" })
      .min(1, { error: "Meta title must not be empty" })
      .max(255, { error: "Meta title must be at most 255 characters" })
      .describe("Translated SEO meta title"),
    metaDescription: z
      .string({ error: "Meta description is required" })
      .min(1, { error: "Meta description must not be empty" })
      .max(500, { error: "Meta description must be at most 500 characters" })
      .describe("Translated SEO meta description"),
    cover: z.httpUrl({ error: "Cover image URL is not valid" }).describe("Cover image URL")
  })
  .extend(collectionSchema.shape)

export type Article = z.output<typeof articleSchema>

export const listArticlesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(articleStatusEnum.enumValues).default("published").describe("Filter by lifecycle status")
})
export const listArticlesResponseSchema = paginatedSchema(articleSchema)

export type ListArticlesQuery = z.output<typeof listArticlesQuerySchema>

// POST /articles (body) — multipart carrying article fields, the first translation, the
// ArticleContent document as a JSON-string part, the mandatory cover file, and inline image
// files whose part names match the upload:// references in the document. Fields reuse the
// articleSchema shape with multipart overrides; the object stays loose with a file catchall so
// dynamically named inline file parts survive validation, and the service cross-checks them.

export const createArticleSchema = z
  .looseObject({
    ...omitCollection(articleSchema).omit({ publishedAt: true }).shape,
    content: jsonStringSchema.pipe(richTextContentSchema),
    cover: articleImage
  })
  .catchall(articleImage)

export type CreateArticleBody = z.output<typeof createArticleSchema>

// GET /articles/:identifier (params) — resolves an Article by uuidv7 id or per-locale Slug.
// The uuidv7 branch is tried first, so an identifier that looks like an id is always treated as an id, never as a Slug.
export const getArticleParamsSchema = z.object({
  identifier: z
    .union([z.uuidv7(), slugSchema], { error: "Invalid identifier" })
    .describe("Article id (uuidv7) or slug in the requested locale")
})

export type GetArticleParams = z.output<typeof getArticleParamsSchema>
