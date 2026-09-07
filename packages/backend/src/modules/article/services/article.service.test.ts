import { faker } from "@faker-js/faker"
import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { mockDeep } from "vitest-mock-extended"

import { config } from "../../../common/config.js"
import type { Database } from "../../../common/database.js"
import type { ListArticlesQuery } from "../schemas/article.schema.js"
import type { ArticleContent } from "../tables/article.table.js"
import { articles, articleTranslations } from "../tables/article.table.js"
import { ArticleService } from "./article.service.js"

interface JoinedArticleRow {
  id: string
  createdAt: Date
  updatedAt: Date
  status: "draft" | "published" | "archived"
  publishedAt: Date | null
  categoryId: string | null
  coverKey: string
  locale: string
  title: string
  slug: string
  excerpt: string
  content: ArticleContent
  metaTitle: string
  metaDescription: string
}

function createJoinedRow(overrides: Partial<JoinedArticleRow> = {}): JoinedArticleRow {
  return {
    id: overrides.id ?? faker.string.uuid({ version: 7 }),
    createdAt: overrides.createdAt ?? faker.date.recent(),
    updatedAt: overrides.updatedAt ?? faker.date.recent(),
    status: overrides.status ?? "published",
    publishedAt: overrides.publishedAt ?? faker.date.recent(),
    categoryId: overrides.categoryId ?? null,
    coverKey: overrides.coverKey ?? "",
    locale: overrides.locale ?? faker.helpers.arrayElement(["en", "id"] as const),
    title: overrides.title ?? faker.lorem.words({ min: 2, max: 5 }),
    slug: overrides.slug ?? faker.lorem.slug(),
    excerpt: overrides.excerpt ?? faker.lorem.sentence(),
    content: overrides.content ?? { type: "doc", content: [] },
    metaTitle: overrides.metaTitle ?? faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: overrides.metaDescription ?? faker.lorem.sentence()
  }
}

function buildRowsChain(rows: JoinedArticleRow[]) {
  const offset = vi.fn<(offset: number) => Promise<JoinedArticleRow[]>>().mockResolvedValue(rows)
  const limit = vi.fn<(limit: number) => { offset: typeof offset }>().mockReturnValue({ offset })
  const orderBy = vi.fn<() => { limit: typeof limit }>().mockReturnValue({ limit })
  const where = vi.fn<(predicate: unknown) => { orderBy: typeof orderBy }>().mockReturnValue({ orderBy })
  const innerJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, where, orderBy, limit, offset }
}

function buildCountChain(total: number) {
  const where = vi
    .fn<(predicate: unknown) => Promise<{ value: number }[]>>()
    .mockResolvedValue([{ value: total }])
  const innerJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, where }
}

function mockListSelect(database: Database, rows: JoinedArticleRow[], total: number) {
  const rowsChain = buildRowsChain(rows)
  const countChain = buildCountChain(total)
  // SAFETY: drizzle select chains are mocked for unit test; return shapes match service usage
  vi.mocked(database.select)
    .mockReturnValueOnce(rowsChain as never)
    .mockReturnValueOnce(countChain as never)
  return { rowsChain, countChain }
}

const pgDialect = new PgDialect()

function renderWhere(whereCall: unknown): { sql: string; params: unknown[] } {
  // SAFETY: the where() argument is always a drizzle SQL instance built by the service
  const rendered = pgDialect.sqlToQuery(whereCall as SQL)
  return { sql: rendered.sql, params: rendered.params }
}

describe("ArticleService", () => {
  describe("list", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    const query = (overrides: Partial<ListArticlesQuery> = {}): ListArticlesQuery => ({
      page: 1,
      limit: 20,
      status: "published",
      ...overrides
    })

    test("returns paginated data with correct mapping and meta", async () => {
      const database = mockDeep<Database>()
      const row = createJoinedRow()
      mockListSelect(database, [row], 1)

      const service = new ArticleService(database)
      const result = await service.list(query(), "en")

      expect(result.data).toEqual([
        {
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
          content: row.content,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
          cover: undefined
        }
      ])
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    })

    test("resolves a stored cover key against the configured public host", async () => {
      const database = mockDeep<Database>()
      const key = `articles/${faker.string.uuid({ version: 7 })}.png`
      mockListSelect(database, [createJoinedRow({ coverKey: key })], 1)

      const service = new ArticleService(database)
      const result = await service.list(query(), "en")

      const cover = result.data[0]?.cover
      expect(cover).toBeDefined()
      const url = new URL(cover ?? "")
      expect(url.origin).toBe(new URL(config.s3.publicBaseUrl).origin)
      expect(url.pathname.endsWith(`/${key}`)).toBe(true)
    })

    test("filters rows and count by the requested locale and the query status", async () => {
      const database = mockDeep<Database>()
      const { rowsChain, countChain } = mockListSelect(database, [], 0)

      const service = new ArticleService(database)
      await service.list(query({ status: "draft" }), "id")

      expect(rowsChain.from).toHaveBeenCalledWith(articles)
      expect(rowsChain.innerJoin).toHaveBeenCalledWith(articleTranslations, expect.anything())

      for (const chain of [rowsChain, countChain]) {
        const rendered = renderWhere(chain.where.mock.calls[0]?.[0])
        expect(rendered.sql).toContain(`"article_translations"."locale"`)
        expect(rendered.sql).toContain(`"articles"."status"`)
        expect(rendered.params).toContain("id")
        expect(rendered.params).toContain("draft")
      }
    })
  })
})
