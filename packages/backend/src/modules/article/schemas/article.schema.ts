import { DEFAULT_LOCALE, LOCALES } from "@bun-boilerplate/i18n"
import { z } from "zod"

import { collectionSchema, richTextContentSchema, slugSchema } from "../../../common/schema.js"
import { paginatedSchema, paginationQuerySchema } from "../../../helpers/pagination.js"
import { articleStatusEnum } from "../tables/article.table.js"

export const articleSchema = z
  .object({
    status: z.enum(articleStatusEnum.enumValues).describe("Lifecycle status of the article"),
    publishedAt: z.date().nullable().readonly().describe("Publication timestamp, null when never published"),
    categoryId: z.uuidv7().nullable().readonly().describe("Article category id, null when uncategorised"),
    locale: z.enum(LOCALES).describe("Locale of the translation carried by this row"),
    title: z.string().describe("Translated title"),
    slug: z.string().describe("Translated slug"),
    excerpt: z.string().describe("Translated excerpt"),
    content: richTextContentSchema.describe("Rich text document with image references resolved to host URLs"),
    metaTitle: z.string().describe("Translated SEO meta title"),
    metaDescription: z.string().describe("Translated SEO meta description"),
    cover: z.url().optional().describe("CoverImage host URL, absent when no cover is stored")
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
// files whose part names match the upload:// references in the document. The object stays loose
// so dynamically named inline file parts survive validation; the service cross-checks them.
export const ARTICLE_MAX_FILE_BYTES = 20 * 1024 * 1024
export const ARTICLE_MAX_REQUEST_BYTES = 100 * 1024 * 1024

const contentJsonSchema = z
  .string({ error: "Content must be a JSON string" })
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw)
    } catch {
      ctx.addIssue({ code: "custom", message: "Content must be a JSON string" })
      return z.NEVER
    }
  })
  .pipe(richTextContentSchema)

export const createArticleSchema = z
  .looseObject({
    status: z.enum(articleStatusEnum.enumValues).optional().describe("Lifecycle status of the article"),
    categoryId: z
      .uuidv7({ error: "Invalid category id" })
      .nullable()
      .optional()
      .describe("Article category id, null when uncategorised"),
    locale: z.enum(LOCALES, { error: "Invalid locale" }).default(DEFAULT_LOCALE),
    title: z
      .string({ error: "Title is required" })
      .min(1, { error: "Title must not be empty" })
      .max(255, { error: "Title must be at most 255 characters" }),
    slug: slugSchema("article"),
    excerpt: z
      .string({ error: "Excerpt is required" })
      .min(1, { error: "Excerpt must not be empty" })
      .max(1000, { error: "Excerpt must be at most 1000 characters" }),
    content: contentJsonSchema,
    metaTitle: z
      .string({ error: "Meta title is required" })
      .min(1, { error: "Meta title must not be empty" })
      .max(255, { error: "Meta title must be at most 255 characters" }),
    metaDescription: z
      .string({ error: "Meta description is required" })
      .min(1, { error: "Meta description must not be empty" })
      .max(500, { error: "Meta description must be at most 500 characters" }),
    cover: z
      .file({ error: "Cover image is required" })
      .max(ARTICLE_MAX_FILE_BYTES, { error: "Cover image must be at most 20 MB" })
  })
  .superRefine((body, ctx) => {
    let total = 0
    for (const value of Object.values(body)) {
      if (value instanceof File) total += value.size
    }
    if (total > ARTICLE_MAX_REQUEST_BYTES) {
      ctx.addIssue({ code: "custom", message: "Total upload size must be at most 100 MB" })
    }
  })

export type CreateArticleBody = z.output<typeof createArticleSchema>

// GET /articles/:identifier (params) — resolves an Article by uuidv7 id or per-locale Slug.
// The uuidv7 branch is tried first, so an identifier that looks like an id is always treated as an id, never as a Slug.
export const getArticleParamsSchema = z.object({
  identifier: z
    .union([z.uuidv7(), slugSchema("article")], { error: "Invalid identifier" })
    .describe("Article id (uuidv7) or slug in the requested locale")
})

export type GetArticleParams = z.output<typeof getArticleParamsSchema>
