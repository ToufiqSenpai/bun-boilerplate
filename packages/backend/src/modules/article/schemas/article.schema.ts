import { LOCALES } from "@bun-boilerplate/i18n"
import { z } from "zod"

import { collectionSchema, slugSchema } from "../../../common/schema.js"
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
    content: z.json().describe("ArticleContent document with image references resolved to host URLs"),
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

// GET /articles/:identifier (params) — resolves an Article by uuidv7 id or per-locale Slug.
// The uuidv7 branch is tried first, so an identifier that looks like an id is always treated as an id, never as a Slug.
export const getArticleParamsSchema = z.object({
  identifier: z
    .union([z.uuidv7(), slugSchema("article")], { error: "Invalid identifier" })
    .describe("Article id (uuidv7) or slug in the requested locale")
})

export type GetArticleParams = z.output<typeof getArticleParamsSchema>
