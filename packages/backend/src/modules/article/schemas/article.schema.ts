import { LOCALES } from "@bun-boilerplate/i18n"
import { z } from "zod"

import { localeHeadersSchema } from "../../../common/i18n.js"
import { collectionSchema } from "../../../common/schema.js"
import { paginatedSchema, paginationQuerySchema } from "../../../helpers/pagination.js"
import { articleStatusEnum } from "../tables/article.table.js"

export const articleListItemSchema = z
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

export type ArticleListItem = z.output<typeof articleListItemSchema>

export const listArticlesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(articleStatusEnum.enumValues).default("published").describe("Filter by lifecycle status")
})
export const listArticlesHeadersSchema = localeHeadersSchema
export const listArticlesResponseSchema = paginatedSchema(articleListItemSchema)

export type ListArticlesQuery = z.output<typeof listArticlesQuerySchema>
