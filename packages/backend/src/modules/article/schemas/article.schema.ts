import { COMMON_IMAGE_MIMETYPE } from "@bun-boilerplate/constants"
import { DEFAULT_LOCALE, LOCALES } from "@bun-boilerplate/i18n"
import { richTextContentSchema } from "@bun-boilerplate/richtext"
import { z } from "zod"

import {
  collectionSchema,
  fileSchema,
  jsonStringSchema,
  omitCollection,
  slugSchema,
  timestampSchema
} from "../../../common/schema.js"
import { paginatedSchema, paginationQuerySchema } from "../../../helpers/pagination.js"
import { articleStatusEnum } from "../tables/article.table.js"

const articleImage = fileSchema.refine(async ({ mime }) => COMMON_IMAGE_MIMETYPE.includes(mime), {
  error: `Cover image mimetype must be ${COMMON_IMAGE_MIMETYPE.join(", ")}.`
})

const articleAuthorSchema = z
  .object({
    id: z.uuidv7({ error: "Author id must be UUIDv7" }).describe("Author's User id"),
    name: z.string().describe("Author's display name"),
    image: z.url({ error: "Author profile image must be a URL" }).nullable().describe("Author profile image URL")
  })
  .describe("User credited with the article")

const authorIdSchema = z
  .uuidv7({ error: "Author id must be UUIDv7" })
  .describe("Id of the User credited as the article author")

export const articleSchema = z
  .object({
    status: z.enum(articleStatusEnum.enumValues).default("draft").describe("Lifecycle status of the article"),
    publishedAt: timestampSchema.nullable().readonly().describe("Publication timestamp, null when never published"),
    categoryId: z
      .uuidv7({ error: "Category id must be UUIDv7" })
      .nullable()
      .describe("Article category id, null when uncategorised"),
    author: articleAuthorSchema.nullable().describe("Article author, null when the account was deleted"),
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
    ...omitCollection(articleSchema).omit({ publishedAt: true, author: true }).shape,
    content: jsonStringSchema.pipe(richTextContentSchema),
    cover: articleImage,
    authorId: authorIdSchema
  })
  .catchall(articleImage)

export type CreateArticleBody = z.output<typeof createArticleSchema>

// PUT /articles/:id/translations/:locale (params + body) — full replacement of one Locale
// ArticleTranslation with no CoverImage part; per-Locale Slug uniqueness is owned by the article
// service through the UNIQUE(locale, slug) constraint (23505 → 409 Slug-conflict)
export const articleTranslationParamsSchema = z.object({
  id: z.uuidv7({ error: "Invalid article id" }).describe("Article id"),
  locale: z.enum(LOCALES, { error: "Invalid locale" }).describe("Locale of the translation to create or replace")
})

export type ArticleTranslationParams = z.output<typeof articleTranslationParamsSchema>

// Body reuses the articleSchema translation fields with the same multipart overrides as
// creation; the object stays loose with a file catchall so dynamically named inline file
// parts survive validation, and the service cross-checks them.
export const upsertArticleTranslationSchema = z
  .looseObject({
    ...omitCollection(articleSchema).omit({
      publishedAt: true,
      status: true,
      categoryId: true,
      locale: true,
      cover: true,
      content: true,
      author: true
    }).shape,
    content: jsonStringSchema.pipe(richTextContentSchema)
  })
  .catchall(articleImage)

export type UpsertArticleTranslationBody = z.output<typeof upsertArticleTranslationSchema>

// GET /articles/:identifier (params) — resolves an Article by uuidv7 id or per-locale Slug.
// The uuidv7 branch is tried first, so an identifier that looks like an id is always treated as an id, never as a Slug.
export const getArticleParamsSchema = z.object({
  identifier: z
    .union([z.uuidv7(), slugSchema], { error: "Invalid identifier" })
    .describe("Article id (uuidv7) or slug in the requested locale")
})

export type GetArticleParams = z.output<typeof getArticleParamsSchema>

// PATCH /articles/:id (params + body) — article-level changes only and no Locale: Status,
// ArticleCategory reassignment (null unsets it), and optional CoverImage replacement. The body is
// strict, so translation fields and stray file parts are rejected as validation errors.
export const updateArticleParamsSchema = z.object({
  id: z.uuidv7({ error: "Invalid article id" }).describe("Article id")
})

export type UpdateArticleParams = z.output<typeof updateArticleParamsSchema>

export const updateArticleSchema = z
  .strictObject({
    // removeDefault keeps an absent Status from parsing as the articleSchema default and resetting it
    status: articleSchema.shape.status.removeDefault(),
    categoryId: articleSchema.shape.categoryId,
    cover: articleImage,
    authorId: authorIdSchema
  })
  .partial()

export type UpdateArticleBody = z.output<typeof updateArticleSchema>

// Response body for PATCH /articles/:id — the article-level half of the read schema, since the
// request carries no Locale and there is no single translation to localize.
export const updateArticleResponseSchema = articleSchema.omit({
  locale: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  metaTitle: true,
  metaDescription: true
})

export type UpdatedArticle = z.output<typeof updateArticleResponseSchema>

// DELETE /articles/:id (params + 204 response) — the params shape is the PATCH shape, aliased to
// keep the route-specific name. Deletion is total: the article row, its cascading translations,
// and every storage key its CoverImage and NodeImage entries reference are removed together.
export const deleteArticleParamsSchema = updateArticleParamsSchema

export type DeleteArticleParams = z.output<typeof deleteArticleParamsSchema>
