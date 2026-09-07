import type { Locale } from "@bun-boilerplate/i18n"
import { and, count, desc, eq } from "drizzle-orm"
import { NotFoundError } from "elysia"
import { z } from "zod"

import { config } from "../../../common/config.js"
import type { Database } from "../../../common/database.js"
import type { Paginated } from "../../../helpers/pagination.js"
import { pageMeta } from "../../../helpers/pagination.js"
import type { Article, ListArticlesQuery } from "../schemas/article.schema.js"
import { articleSchema } from "../schemas/article.schema.js"
import {
  articles,
  articleTranslations,
  type ArticleContent,
  type ArticleContentValue,
  type ArticleStatus
} from "../tables/article.table.js"

const articleProjection = {
  id: articles.id,
  createdAt: articles.createdAt,
  updatedAt: articles.updatedAt,
  status: articles.status,
  publishedAt: articles.publishedAt,
  categoryId: articles.categoryId,
  coverKey: articles.coverKey,
  locale: articleTranslations.locale,
  title: articleTranslations.title,
  slug: articleTranslations.slug,
  excerpt: articleTranslations.excerpt,
  content: articleTranslations.content,
  metaTitle: articleTranslations.metaTitle,
  metaDescription: articleTranslations.metaDescription
}

export interface JoinedArticleRow {
  id: string
  createdAt: Date
  updatedAt: Date
  status: ArticleStatus
  publishedAt: Date | null
  categoryId: string | null
  coverKey: string
  locale: Locale
  title: string
  slug: string
  excerpt: string
  content: ArticleContent
  metaTitle: string
  metaDescription: string
}

export class ArticleService {
  private readonly imageNodeSchema = z.looseObject({
    type: z.literal("image"),
    attrs: z.looseObject({ src: z.string() })
  })

  public constructor(private readonly database: Database) {}

  public async list(
    query: ListArticlesQuery,
    locale: Locale,
    canViewUnpublished = false
  ): Promise<Paginated<typeof articleSchema>> {
    const offset = (query.page - 1) * query.limit

    const status = canViewUnpublished ? query.status : "published"
    const wherePredicate = and(eq(articleTranslations.locale, locale), eq(articles.status, status))

    const [rows, [countResult]] = await Promise.all([
      this.database
        .select(articleProjection)
        .from(articles)
        .innerJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(wherePredicate)
        .orderBy(desc(articles.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database
        .select({ value: count() })
        .from(articles)
        .innerJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(wherePredicate)
    ])

    const total = countResult?.value ?? 0

    return {
      data: rows.map(row => this.mapRow(row)),
      meta: pageMeta(query, total)
    }
  }

  public async getByIdentifier(identifier: string, locale: Locale, canViewUnpublished = false): Promise<Article> {
    const isId = z.uuidv7().safeParse(identifier).success
    const predicate = and(
      canViewUnpublished ? undefined : eq(articles.status, "published"),
      eq(articleTranslations.locale, locale),
      isId ? eq(articles.id, identifier) : eq(articleTranslations.slug, identifier)
    )

    const [row] = await this.database
      .select(articleProjection)
      .from(articles)
      .innerJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
      .where(predicate)
      .limit(1)
    if (!row) throw new NotFoundError("Article not found")

    return this.mapRow(row)
  }

  private mapRow(row: JoinedArticleRow): Article {
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status,
      publishedAt: row.publishedAt,
      categoryId: row.categoryId,
      locale: row.locale,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: this.resolveContentUrls(row.content),
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      cover: this.toPublicUrl(row.coverKey)
    }
  }

  private toPublicUrl(key: string): string | undefined {
    if (!key) return undefined
    // ponytail: any scheme-prefixed src (https://, upload://) passes through; StorageKeys containing ":" in
    // the first segment would read as a scheme too — #49 generates uuid names, revisit if keys ever allow ":"
    if (URL.canParse(key)) return key
    const encoded = key.split("/").map(encodeURIComponent).join("/")
    return new URL(encoded, `${config.s3.publicBaseUrl.replace(/\/$/, "")}/`).href
  }

  private resolveContentUrls(content: ArticleContent): ArticleContent {
    // SAFETY: the document root is a JSON object and resolveValue preserves its object shape
    return this.resolveValue(content) as ArticleContent
  }

  private resolveValue(value: ArticleContentValue): ArticleContentValue {
    if (Array.isArray(value)) return value.map(v => this.resolveValue(v))
    if (!(value instanceof Object)) return value

    // SAFETY: a JSON value that is an Object and not an Array is the object shape of ArticleContentValue
    const node = value as Record<string, ArticleContentValue>
    const resolved = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, this.resolveValue(v)]))
    const image = this.imageNodeSchema.safeParse(node)
    if (!image.success) return resolved

    // SAFETY: imageNodeSchema proves node.attrs is a plain object and resolved preserves its shape
    const attrs = resolved.attrs as Record<string, ArticleContentValue>
    return { ...resolved, attrs: { ...attrs, src: this.toPublicUrl(image.data.attrs.src) ?? image.data.attrs.src } }
  }
}
