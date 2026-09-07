import type { RichText } from "@bun-boilerplate/richtext"
import { faker } from "@faker-js/faker"
import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { mockDeep } from "vitest-mock-extended"

import { config } from "../../../common/config.js"
import type { Database } from "../../../common/database.js"
import type { ListArticlesQuery } from "../schemas/article.schema.js"
import { articles, articleTranslations } from "../tables/article.table.js"
import type { JoinedArticleRow } from "./article.service.js"
import { ArticleService } from "./article.service.js"

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

function buildJoinedLimitChain(rows: JoinedArticleRow[]) {
  const limit = vi.fn<(limit: number) => Promise<JoinedArticleRow[]>>().mockResolvedValue(rows)
  const where = vi.fn<(predicate: unknown) => { limit: typeof limit }>().mockReturnValue({ limit })
  const innerJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, where, limit }
}

function mockGetSelect(database: Database, rows: JoinedArticleRow[]) {
  const chain = buildJoinedLimitChain(rows)
  // SAFETY: drizzle select chain is mocked for unit test; return shape matches service usage
  vi.mocked(database.select).mockReturnValueOnce(chain as never)
  return chain
}

function buildCountChain(total: number) {
  const where = vi.fn<(predicate: unknown) => Promise<{ value: number }[]>>().mockResolvedValue([{ value: total }])
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

function renderWhere(whereCall: unknown) {
  // SAFETY: the where() argument is always a drizzle SQL instance built by the service
  return pgDialect.sqlToQuery(whereCall as SQL)
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

    test("rewrites nested NodeImage src keys to host URLs, passing external and upload refs through", async () => {
      const database = mockDeep<Database>()
      const key = `articles/${faker.string.uuid({ version: 7 })}.jpg`
      const external = "https://cdn.example.org/pic.png"
      const hostUrl = new URL(key, `${config.s3.publicBaseUrl.replace(/\/$/, "")}/`).href
      const content: RichText = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "image", attrs: { src: key, alt: "a" } }]
          },
          { type: "image", attrs: { src: external } },
          { type: "image", attrs: { src: "upload://part-1" } },
          { type: "image", attrs: { src: 42 }, content: [{ type: "image", attrs: { src: key } }] }
        ]
      }
      const contentCopy = structuredClone(content)
      mockListSelect(database, [createJoinedRow({ content })], 1)

      const service = new ArticleService(database)
      const result = await service.list(query(), "en")

      // SAFETY: the resolver preserves document shape; the literal below restates the seeded one
      const expected = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "image", attrs: { src: hostUrl, alt: "a" } }]
          },
          { type: "image", attrs: { src: external } },
          { type: "image", attrs: { src: "upload://part-1" } },
          { type: "image", attrs: { src: 42 }, content: [{ type: "image", attrs: { src: hostUrl } }] }
        ]
      }
      expect(structuredClone(result.data[0]?.content)).toEqual(expected)
      expect(content).toEqual(contentCopy)
    })

    test("filters rows and count by the requested locale and the query status for a privileged viewer", async () => {
      const database = mockDeep<Database>()
      const { rowsChain, countChain } = mockListSelect(database, [], 0)

      const service = new ArticleService(database)
      await service.list(query({ status: "draft" }), "id", true)

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

    test("forces the published status for a non-privileged viewer regardless of the query", async () => {
      const database = mockDeep<Database>()
      const { rowsChain, countChain } = mockListSelect(database, [], 0)

      const service = new ArticleService(database)
      await service.list(query({ status: "draft" }), "en")

      for (const chain of [rowsChain, countChain]) {
        const rendered = renderWhere(chain.where.mock.calls[0]?.[0])
        expect(rendered.params).toContain("published")
        expect(rendered.params).not.toContain("draft")
      }
    })
  })

  describe("getByIdentifier", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    test("resolves a published article by uuidv7 id through id, status, and locale predicates", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      const row = createJoinedRow({ id })
      const chain = mockGetSelect(database, [row])

      const service = new ArticleService(database)
      const result = await service.getByIdentifier(id, "en")

      expect(result).toEqual({
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
      })
      expect(chain.from).toHaveBeenCalledWith(articles)
      expect(chain.innerJoin).toHaveBeenCalledWith(articleTranslations, expect.anything())
      expect(chain.limit).toHaveBeenCalledWith(1)

      const rendered = renderWhere(chain.where.mock.calls[0]?.[0])
      expect(rendered.sql).toContain(`"articles"."id"`)
      expect(rendered.sql).toContain(`"articles"."status"`)
      expect(rendered.sql).toContain(`"article_translations"."locale"`)
      expect(rendered.sql).not.toContain(`"article_translations"."slug"`)
      expect(rendered.params).toContain(id)
      expect(rendered.params).toContain("published")
      expect(rendered.params).toContain("en")
    })

    test("resolves by slug through slug, status, and locale predicates when the identifier is not an id", async () => {
      const database = mockDeep<Database>()
      const slug = faker.lorem.slug()
      const row = createJoinedRow({ slug })
      const chain = mockGetSelect(database, [row])

      const service = new ArticleService(database)
      const result = await service.getByIdentifier(slug, "id")

      expect(result.slug).toBe(slug)
      const rendered = renderWhere(chain.where.mock.calls[0]?.[0])
      expect(rendered.sql).toContain(`"article_translations"."slug"`)
      expect(rendered.sql).toContain(`"articles"."status"`)
      expect(rendered.sql).toContain(`"article_translations"."locale"`)
      expect(rendered.sql).not.toContain(`"articles"."id"`)
      expect(rendered.params).toContain(slug)
      expect(rendered.params).toContain("id")
    })

    test("drops the status predicate for a privileged viewer so draft and archived rows resolve", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      const row = createJoinedRow({ id, status: "draft" })
      const chain = mockGetSelect(database, [row])

      const service = new ArticleService(database)
      const result = await service.getByIdentifier(id, "en", true)

      expect(result.status).toBe("draft")
      const rendered = renderWhere(chain.where.mock.calls[0]?.[0])
      expect(rendered.sql).not.toContain(`"articles"."status"`)
      expect(rendered.params).not.toContain("published")
    })

    test("throws not-found when no published translation matches the identifier and locale", async () => {
      const database = mockDeep<Database>()
      mockGetSelect(database, [])

      const service = new ArticleService(database)
      await expect(service.getByIdentifier(faker.lorem.slug(), "en")).rejects.toThrow("Article not found")
    })
  })
})
