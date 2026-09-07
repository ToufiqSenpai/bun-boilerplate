import type { Locale } from "@bun-boilerplate/i18n"
import { and, count, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { config } from "../../../common/config.js"
import type { Database } from "../../../common/database.js"
import type { Paginated } from "../../../helpers/pagination.js"
import type { ArticleListItem, ListArticlesQuery } from "../schemas/article.schema.js"
import { articleListItemSchema } from "../schemas/article.schema.js"
import {
  articles,
  articleTranslations,
  type ArticleContent,
  type ArticleContentValue
} from "../tables/article.table.js"

const ABSOLUTE_URL = /^https?:\/\//i

function toPublicUrl(key: string): string | undefined {
  if (!key) return undefined
  if (ABSOLUTE_URL.test(key)) return key
  return new URL(key.replace(/ /g, "%20"), `${config.s3.publicBaseUrl.replace(/\/$/, "")}/`).href
}

const imageNodeSchema = z.looseObject({
  type: z.literal("image"),
  attrs: z.looseObject({ src: z.string() })
})

function resolveValue(value: ArticleContentValue): ArticleContentValue {
  if (Array.isArray(value)) return value.map(resolveValue)
  if (!(value instanceof Object)) return value

  // SAFETY: a JSON value that is an Object and not an Array is the object shape of ArticleContentValue
  const node = value as Record<string, ArticleContentValue>
  const image = imageNodeSchema.safeParse(node)
  if (image.success) {
    // SAFETY: imageNodeSchema proves node.attrs is a plain object
    const attrs = node.attrs as Record<string, ArticleContentValue>
    return { ...node, attrs: { ...attrs, src: toPublicUrl(image.data.attrs.src) ?? image.data.attrs.src } }
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveValue(v)]))
}

interface JoinedArticleRow {
  id: string
  createdAt: Date
  updatedAt: Date
  status: "draft" | "published" | "archived"
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

function resolveContentUrls(content: ArticleContent): ArticleContent {
  // SAFETY: the document root is a JSON object and resolveValue preserves its object shape
  return resolveValue(content) as ArticleContent
}

export class ArticleService {
  private readonly articleProjection = {
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

  public constructor(private readonly database: Database) {}

  public async list(query: ListArticlesQuery, locale: Locale): Promise<Paginated<typeof articleListItemSchema>> {
    const offset = (query.page - 1) * query.limit

    const wherePredicate = and(eq(articleTranslations.locale, locale), eq(articles.status, query.status))

    const [rows, [countResult]] = await Promise.all([
      this.database
        .select(this.articleProjection)
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
      data: rows.map(row => this.toListItem(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit)
      }
    }
  }

  private toListItem(row: JoinedArticleRow): ArticleListItem {
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
      content: resolveContentUrls(row.content),
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      cover: toPublicUrl(row.coverKey)
    }
  }
}
