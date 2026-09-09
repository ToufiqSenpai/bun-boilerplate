import type { RichText } from "@bun-boilerplate/richtext"
import { faker } from "@faker-js/faker"
import type { SQL } from "drizzle-orm"
import { eq } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { ValidationError } from "elysia"
import { mockDeep } from "vitest-mock-extended"

import { config } from "../../../common/config.js"
import { database } from "../../../common/database.js"
import type { Database } from "../../../common/database.js"
import { ConflictError } from "../../../common/error.js"
import type { FileSchema } from "../../../common/schema.js"
import type { FileMetadata, Storage, UploadFileParams } from "../../../common/storage/storage.js"
import type { CreateArticleBody, ListArticlesQuery } from "../schemas/article.schema.js"
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
    coverKey: overrides.coverKey ?? `articles/${faker.string.uuid({ version: 7 })}.png`,
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

// Minimal valid headers, verified against file-type: detection reads structure, not just magic.
const PNG_1X1 = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
  0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]
const JPEG_MINIMAL = [
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9
]

function imageFile(name: string, magic: number[], type: string, size = 1024): File {
  const body = new Uint8Array(Math.max(size, magic.length))
  body.set(magic)
  return new File([body], name, { type })
}

function pngFile(name: string, size = 1024): File {
  return imageFile(name, PNG_1X1, "image/png", size)
}

function jpegFile(name: string, size = 1024): File {
  return imageFile(name, JPEG_MINIMAL, "image/jpeg", size)
}

function filePart(file: File, mime: string, extension: string): FileSchema {
  return { file, mime, extension }
}

function createTestStorage() {
  const storage = mockDeep<Storage>()
  const objects = new Map<string, { size: number; contentType?: string | undefined }>()

  storage.upload.mockImplementation(async ({ key, stream, headers }: UploadFileParams): Promise<FileMetadata> => {
    let size = 0
    for await (const chunk of stream) {
      // SAFETY: storage upload streams deliver binary chunks; only the byte length is observed
      size += (chunk as Uint8Array).length
    }
    const keyString = key.toString()
    objects.set(keyString, { size, contentType: headers?.contentType })
    return { key: keyString, contentType: headers?.contentType, size }
  })
  storage.delete.mockImplementation(async key => {
    objects.delete(key.toString())
  })

  return { storage, objects }
}

function createBody(overrides: Record<string, string | RichText | FileSchema | null> = {}): CreateArticleBody {
  // SAFETY: base literal mirrors createArticleSchema output; overrides carry dynamic inline file parts
  return {
    status: "draft",
    locale: "en",
    title: faker.lorem.words({ min: 2, max: 5 }),
    slug: `${faker.lorem.slug()}-${faker.string.uuid({ version: 7 }).slice(0, 8)}`,
    excerpt: faker.lorem.sentence(),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    metaTitle: faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: faker.lorem.sentence(),
    cover: filePart(pngFile("cover.png"), "image/png", "png"),
    ...overrides
  } as CreateArticleBody
}

async function readStoredArticle(id: string) {
  const [article] = await database.select().from(articles).where(eq(articles.id, id)).limit(1)
  const [translation] = await database
    .select()
    .from(articleTranslations)
    .where(eq(articleTranslations.articleId, id))
    .limit(1)
  if (!article || !translation) throw new Error("article not persisted")
  return { article, translation }
}

async function countArticles(): Promise<number> {
  return (await database.select({ id: articles.id }).from(articles)).length
}

interface ValidationPayload {
  property: string
  message: string
  errors: { path: (string | number)[]; message: string }[]
}

function validationPayload(error: unknown): ValidationPayload {
  expect(error).toBeInstanceOf(ValidationError)
  // SAFETY: instanceof narrows to Elysia ValidationError whose message carries the JSON validation envelope
  return JSON.parse((error as ValidationError).message) as ValidationPayload
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

      const service = new ArticleService(database, mockDeep<Storage>())
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
          cover: `${config.s3.publicBaseUrl.replace(/\/$/, "")}/${row.coverKey}`
        }
      ])
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    })

    test("resolves a stored cover key against the configured public host", async () => {
      const database = mockDeep<Database>()
      const key = `articles/${faker.string.uuid({ version: 7 })}.png`
      mockListSelect(database, [createJoinedRow({ coverKey: key })], 1)

      const service = new ArticleService(database, mockDeep<Storage>())
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

      const service = new ArticleService(database, mockDeep<Storage>())
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

      const service = new ArticleService(database, mockDeep<Storage>())
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

      const service = new ArticleService(database, mockDeep<Storage>())
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

      const service = new ArticleService(database, mockDeep<Storage>())
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
        cover: `${config.s3.publicBaseUrl.replace(/\/$/, "")}/${row.coverKey}`
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

      const service = new ArticleService(database, mockDeep<Storage>())
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

      const service = new ArticleService(database, mockDeep<Storage>())
      const result = await service.getByIdentifier(id, "en", true)

      expect(result.status).toBe("draft")
      const rendered = renderWhere(chain.where.mock.calls[0]?.[0])
      expect(rendered.sql).not.toContain(`"articles"."status"`)
      expect(rendered.params).not.toContain("published")
    })

    test("throws not-found when no published translation matches the identifier and locale", async () => {
      const database = mockDeep<Database>()
      mockGetSelect(database, [])

      const service = new ArticleService(database, mockDeep<Storage>())
      await expect(service.getByIdentifier(faker.lorem.slug(), "en")).rejects.toThrow("Article not found")
    })
  })

  describe("create", () => {
    test("persists keys and serves urls for cover plus inline images", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const body = createBody({
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "hello" }] },
            { type: "image", attrs: { src: "upload://inline-1", alt: "inline" } }
          ]
        },
        "inline-1": filePart(jpegFile("inline-1"), "image/jpeg", "jpg")
      })

      const result = await service.create(body)

      expect(result.slug).toBe(body.slug)
      expect(result.title).toBe(body.title)
      expect(result.cover).toMatch(/^https?:\/\//)
      const stored = await readStoredArticle(result.id)
      expect(stored.article.coverKey).not.toBe("")
      expect(result.cover.endsWith(`/${stored.article.coverKey}`)).toBe(true)
      expect(stored.article.coverKey).toMatch(/^articles\/.+\.png$/)
      expect(JSON.stringify(stored.translation.content)).not.toContain("upload://")
      expect(JSON.stringify(stored.translation.content)).not.toContain("http")
      // SAFETY: shape mirrors the image-node literal seeded in the request body above
      const content = stored.translation.content as { content: { attrs: { src: string } }[] }
      // SAFETY: served content carries the same document shape with keys resolved to host URLs
      const served = result.content as { content: { attrs: { src: string } }[] }
      expect(served.content[1]?.attrs.src.endsWith(`/${content.content[1]?.attrs.src}`)).toBe(true)
      expect(content.content[1]?.attrs.src).toMatch(/^articles\/.+\.jpg$/)
      expect(objects.size).toBe(2)
    })

    test("forwards the abort signal to cover and inline uploads", async () => {
      const storage = mockDeep<Storage>()
      storage.upload.mockResolvedValue({ key: "articles/a.png" })
      const controller = new AbortController()
      const service = new ArticleService(database, storage)
      const body = createBody({
        content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://inline-1" } }] },
        "inline-1": filePart(jpegFile("inline-1"), "image/jpeg", "jpg")
      })

      await service.create(body, controller.signal)

      expect(storage.upload).toHaveBeenCalledTimes(2)
      for (const call of storage.upload.mock.calls) expect(call[0].signal).toBe(controller.signal)
    })

    test("rejects a placeholder without a matching file, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const before = await countArticles()
      const body = createBody({
        content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://ghost" } }] }
      })

      const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["content"], message: expect.stringContaining("ghost") })
      ])
      expect(await countArticles()).toBe(before)
      expect(objects.size).toBe(0)
    })

    test("rejects a file without a matching placeholder, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const before = await countArticles()
      const body = createBody({ stray: filePart(pngFile("stray.png"), "image/png", "png") })

      const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["stray"], message: expect.stringContaining("stray") })
      ])
      expect(await countArticles()).toBe(before)
      expect(objects.size).toBe(0)
    })

    test("surfaces a per-locale slug collision as a 409 conflict", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const first = await service.create(createBody())
      const before = await countArticles()

      const error = await service.create(createBody({ slug: first.slug })).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(ConflictError)
      // SAFETY: error is ConflictError per previous expect
      expect((error as ConflictError).status).toBe(409)
      // SAFETY: error is ConflictError per previous expect
      expect((error as ConflictError).message).toBe("Slug already exists")
      expect(await countArticles()).toBe(before)
      // The colliding cover upload is compensated, leaving only the first article's cover
      expect(objects.size).toBe(1)
    })

    test("rejects an unknown category id without leaking a server error", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const before = await countArticles()

      const payload = validationPayload(
        await service
          .create(createBody({ categoryId: faker.string.uuid({ version: 7 }) }))
          .catch((error: unknown) => error)
      )

      expect(payload.errors).toEqual([expect.objectContaining({ path: ["categoryId"] })])
      expect(await countArticles()).toBe(before)
      expect(objects.size).toBe(0)
    })
  })
})
