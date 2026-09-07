import type { Locale } from "@bun-boilerplate/i18n"
import { and, count, desc, eq } from "drizzle-orm"

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
  return new URL(`${key.replace(/ /g, "%20")}`, `${config.s3.publicBaseUrl.replace(/\/$/, "")}/`).href
}

function resolveValue(value: ArticleContentValue): ArticleContentValue {
  if (Array.isArray(value)) return value.map(resolveValue)
  if (value === null || typeof value !== "object") return value

  // SAFETY: JSON objects are narrowed to plain records by the guard above
  const node = value as Record<string, ArticleContentValue>
  if (node.type === "image") {
    const attrs = node.attrs
    if (attrs !== null && typeof attrs === "object" && !Array.isArray(attrs)) {
      const src = attrs.src
      if (typeof src === "string") {
        return { ...node, attrs: { ...attrs, src: toPublicUrl(src) ?? src } }
      }
    }
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
