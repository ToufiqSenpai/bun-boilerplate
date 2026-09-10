import { Readable } from "stream"

import type { RichText } from "@bun-boilerplate/richtext"
import { faker } from "@faker-js/faker"
import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { NotFoundError, ValidationError } from "elysia"
import { mockDeep } from "vitest-mock-extended"

import { config } from "../../../common/config.js"
import { database } from "../../../common/database.js"
import type { Database } from "../../../common/database.js"
import { ConflictError } from "../../../common/error.js"
import type { FileSchema } from "../../../common/schema.js"
import { StorageKey } from "../../../common/storage/storage-key.js"
import type { FileMetadata, Storage, UploadFileParams } from "../../../common/storage/storage.js"
import type { CreateArticleBody, ListArticlesQuery, UpsertArticleTranslationBody } from "../schemas/article.schema.js"
import { users } from "../../auth/tables/auth.table.js"
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
    authorId: overrides.authorId ?? null,
    authorName: overrides.authorName ?? null,
    authorImage: overrides.authorImage ?? null,
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
  const leftJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const innerJoin = vi.fn<() => { leftJoin: typeof leftJoin }>().mockReturnValue({ leftJoin })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, leftJoin, where, orderBy, limit, offset }
}

function buildJoinedLimitChain(rows: JoinedArticleRow[]) {
  const limit = vi.fn<(limit: number) => Promise<JoinedArticleRow[]>>().mockResolvedValue(rows)
  const where = vi.fn<(predicate: unknown) => { limit: typeof limit }>().mockReturnValue({ limit })
  const leftJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const innerJoin = vi.fn<() => { leftJoin: typeof leftJoin }>().mockReturnValue({ leftJoin })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, leftJoin, where, limit }
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
    for (const item of Array.isArray(key) ? key : [key]) objects.delete(item.toString())
  })

  return { storage, objects }
}

function translationFields() {
  return {
    title: faker.lorem.words({ min: 2, max: 5 }),
    slug: `${faker.lorem.slug()}-${faker.string.uuid({ version: 7 }).slice(0, 8)}`,
    excerpt: faker.lorem.sentence(),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    metaTitle: faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: faker.lorem.sentence()
  }
}

function createBody(overrides: Record<string, string | RichText | FileSchema | null> = {}): CreateArticleBody {
  // SAFETY: base literal mirrors createArticleSchema output; overrides carry dynamic inline file parts
  return {
    status: "draft",
    locale: "en",
    authorId: faker.string.uuid({ version: 7 }),
    ...translationFields(),
    cover: filePart(pngFile("cover.png"), "image/png", "png"),
    ...overrides
  } as CreateArticleBody
}

function createUpsertBody(
  overrides: Record<string, string | RichText | FileSchema | null> = {}
): UpsertArticleTranslationBody {
  // SAFETY: base literal mirrors upsertArticleTranslationSchema output; overrides carry dynamic inline file parts
  return {
    ...translationFields(),
    ...overrides
  } as UpsertArticleTranslationBody
}

interface ArticleRow {
  id: string
  createdAt: Date
  updatedAt: Date
  status: string
  publishedAt: Date | null
  categoryId: string | null
  coverKey: string
  authorId: string | null
}

interface InsertedArticle {
  id: string
  status: string
  coverKey: string
  categoryId: string | null
  authorId: string
}

interface InsertedTranslation {
  articleId: string
  locale: string
  title: string
  slug: string
  excerpt: string
  content: RichText
  metaTitle: string
  metaDescription: string
}

interface ArticleChanges {
  status?: string
  publishedAt?: Date
  categoryId?: string | null
  coverKey?: string
  authorId?: string
}

interface AuthorRow {
  authorId: string
  authorName: string
  authorImage: string | null
}

function createAuthorRow(overrides: Partial<AuthorRow> = {}): AuthorRow {
  return {
    authorId: overrides.authorId ?? faker.string.uuid({ version: 7 }),
    authorName: overrides.authorName ?? faker.person.fullName(),
    authorImage: overrides.authorImage ?? faker.image.url()
  }
}

type StubFn = ReturnType<typeof vi.fn>

function createTransaction() {
  const insert = vi.fn<() => object>()
  const select = vi.fn<() => object>()
  const update = vi.fn<() => object>()
  const remove = vi.fn<() => object>()
  return { handles: { insert, select, update, delete: remove }, insert, select, update, remove }
}

function spyTransaction(tx: Record<string, StubFn>) {
  // SAFETY: tx handles mirror the drizzle transaction handle the service receives
  return vi.spyOn(database, "transaction").mockImplementation(async callback => callback(tx as never))
}

function selectChain<Row>(rows: Row[]) {
  const promise = Promise.resolve(rows)
  const chain = {
    from: vi.fn<() => object>(),
    innerJoin: vi.fn<() => object>(),
    leftJoin: vi.fn<() => object>(),
    where: vi.fn<() => object>(),
    limit: vi.fn<() => object>(),
    for: vi.fn<() => object>(),
    then: promise.then.bind(promise)
  }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.leftJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.for.mockReturnValue(chain)
  return chain
}

function insertHandle<Values extends object>(buildRow: (values: Values) => object) {
  let captured: Values | undefined
  const returning = vi.fn<() => Promise<object[]>>(async () => {
    if (captured === undefined) throw new Error("values() must run before returning()")
    return [buildRow(captured)]
  })
  const onConflictDoUpdate = vi.fn<() => { returning: typeof returning }>(() => ({ returning }))
  const values = vi.fn<(input: Values) => { returning: typeof returning; onConflictDoUpdate: typeof onConflictDoUpdate }>(
    input => {
      captured = input
      return { returning, onConflictDoUpdate }
    }
  )
  return { values, onConflictDoUpdate }
}

function updateHandle<Changes extends object>(buildRow: (changes: Changes) => object) {
  let captured: Changes | undefined
  const returning = vi.fn<() => Promise<object[]>>(async () => {
    if (captured === undefined) throw new Error("set() must run before returning()")
    return [buildRow(captured)]
  })
  const where = vi.fn<() => { returning: typeof returning }>(() => ({ returning }))
  const set = vi.fn<(input: Changes) => { where: typeof where }>(input => {
    captured = input
    return { where }
  })
  return { set, returning }
}

function deleteHandle() {
  const where = vi.fn<() => Promise<never[]>>(async () => [])
  return { where }
}

function codedError(code: string): Error {
  return Object.assign(new Error(`pg error ${code}`), { code })
}

function wrappedError(code: string): Error {
  return new Error("query failed", { cause: codedError(code) })
}

function articleRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: faker.string.uuid({ version: 7 }),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    status: "draft",
    publishedAt: null,
    categoryId: null,
    coverKey: `articles/${faker.string.uuid({ version: 7 })}.png`,
    authorId: null,
    ...overrides
  }
}

async function seedStoredObject(storage: Storage, key: string): Promise<void> {
  await storage.upload({ key: new StorageKey(key), stream: Readable.from([]) })
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
          cover: `${config.s3.publicBaseUrl.replace(/\/$/, "")}/${row.coverKey}`,
          author: null
        }
      ])
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    })

    test("resolves a stored cover key against the configured public host", async () => {      const database = mockDeep<Database>()
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

    test("maps the joined author and joins the users table", async () => {
      const database = mockDeep<Database>()
      const author = createAuthorRow()
      const row = createJoinedRow(author)
      const { rowsChain } = mockListSelect(database, [row], 1)

      const service = new ArticleService(database, mockDeep<Storage>())
      const result = await service.list(query(), "en")

      expect(result.data[0]?.author).toEqual({
        id: author.authorId,
        name: author.authorName,
        image: author.authorImage
      })
      expect(rowsChain.leftJoin).toHaveBeenCalledWith(users, expect.anything())
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
        cover: `${config.s3.publicBaseUrl.replace(/\/$/, "")}/${row.coverKey}`,
        author: null
      })
      expect(chain.from).toHaveBeenCalledWith(articles)
      expect(chain.innerJoin).toHaveBeenCalledWith(articleTranslations, expect.anything())
      expect(chain.leftJoin).toHaveBeenCalledWith(users, expect.anything())
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
    afterEach(() => {
      vi.restoreAllMocks()
    })

    function setupCreate(author = createAuthorRow()) {
      const articleInsert = insertHandle<InsertedArticle>(values => ({
        ...values,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null
      }))
      const translationInsert = insertHandle<InsertedTranslation>(values => values)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([author]))
      tx.insert
        .mockReturnValueOnce({ values: articleInsert.values })
        .mockReturnValueOnce({ values: translationInsert.values })
      const transaction = spyTransaction(tx.handles)
      return { articleInsert, translationInsert, transaction, author }
    }

    test("persists the author id and returns the resolved author", async () => {
      const { storage } = createTestStorage()
      const service = new ArticleService(database, storage)
      const author = createAuthorRow()
      const { articleInsert } = setupCreate(author)

      const result = await service.create(createBody({ authorId: author.authorId }))

      // SAFETY: the create flow inserted exactly one article payload
      const articleValues = articleInsert.values.mock.calls[0]?.[0] as { authorId: string }
      expect(articleValues.authorId).toBe(author.authorId)
      expect(result.author).toEqual({
        id: author.authorId,
        name: author.authorName,
        image: author.authorImage
      })
    })

    test("rejects an unknown author id with a 404, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([]))
      spyTransaction(tx.handles)

      const error = await service.create(createBody()).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).status).toBe(404)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).message).toBe("Author not found")
      expect(tx.insert).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })

    test("persists resolved keys for cover and inline images and serves host urls", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const { articleInsert, translationInsert } = setupCreate()
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

      // SAFETY: the create flow inserted exactly one payload into each table
      const articleValues = articleInsert.values.mock.calls[0]?.[0] as { coverKey: string }
      // SAFETY: the create flow inserted exactly one payload into each table
      const translationValues = translationInsert.values.mock.calls[0]?.[0] as { content: RichText }
      const storedContent = translationValues.content
      expect(result.slug).toBe(body.slug)
      expect(result.title).toBe(body.title)
      expect(articleValues.coverKey).toMatch(/^articles\/.+\.png$/)
      expect(result.cover.endsWith(`/${articleValues.coverKey}`)).toBe(true)
      expect(JSON.stringify(storedContent)).not.toContain("upload://")
      expect(JSON.stringify(storedContent)).not.toContain("http")
      // SAFETY: shape mirrors the image-node literal seeded in the request body above
      const content = storedContent as { content: { attrs: { src: string } }[] }
      // SAFETY: served content carries the same document shape with keys resolved to host URLs
      const served = result.content as { content: { attrs: { src: string } }[] }
      const inlineKey = content.content[1]?.attrs.src
      expect(inlineKey).toMatch(/^articles\/.+\.jpg$/)
      expect(served.content[1]?.attrs.src.endsWith(`/${inlineKey ?? ""}`)).toBe(true)
      expect(objects.size).toBe(2)
      expect(objects.has(articleValues.coverKey)).toBe(true)
      expect(objects.has(inlineKey ?? "")).toBe(true)
    })

    test("forwards the abort signal to cover and inline uploads", async () => {
      const storage = mockDeep<Storage>()
      storage.upload.mockResolvedValue({ key: "articles/a.png" })
      const controller = new AbortController()
      const service = new ArticleService(database, storage)
      setupCreate()
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
      const { transaction } = setupCreate()
      const body = createBody({
        content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://ghost" } }] }
      })

      const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["content"], message: expect.stringContaining("ghost") })
      ])
      expect(transaction).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })

    test("rejects a file without a matching placeholder, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const { transaction } = setupCreate()
      const body = createBody({ stray: filePart(pngFile("stray.png"), "image/png", "png") })

      const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["stray"], message: expect.stringContaining("stray") })
      ])
      expect(transaction).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })

    test("surfaces a per-locale slug collision as a 409 conflict, compensating uploads", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      vi.spyOn(database, "transaction").mockRejectedValue(wrappedError("23505"))

      const error = await service.create(createBody()).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(ConflictError)
      // SAFETY: error is ConflictError per previous expect
      expect((error as ConflictError).status).toBe(409)
      // SAFETY: error is ConflictError per previous expect
      expect((error as ConflictError).message).toBe("Slug already exists")
      expect(objects.size).toBe(0)
    })

    test("rejects an unknown category id with a 404 without leaking a server error", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      vi.spyOn(database, "transaction").mockRejectedValue(wrappedError("23503"))

      const error = await service
        .create(createBody({ categoryId: faker.string.uuid({ version: 7 }) }))
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).status).toBe(404)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).message).toBe("Category not found")
      expect(objects.size).toBe(0)
    })
  })

  describe("upsertTranslation", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test("replaces text plus content with new inline images, leaving the cover byte-identical", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      const dropKey = `articles/${faker.string.uuid({ version: 7 })}.jpg`
      await seedStoredObject(storage, row.coverKey)
      await seedStoredObject(storage, dropKey)
      const oldContent: RichText = { type: "doc", content: [{ type: "image", attrs: { src: dropKey } }] }
      const translationInsert = insertHandle<InsertedTranslation>(values => values)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row])).mockReturnValueOnce(selectChain([{ content: oldContent }]))
      tx.insert.mockReturnValueOnce({ values: translationInsert.values })
      spyTransaction(tx.handles)

      const { translation, created: wasCreated } = await service.upsertTranslation(
        { id: row.id, locale: "en" },
        createUpsertBody({
          title: "Fresh title",
          content: {
            type: "doc",
            content: [{ type: "image", attrs: { src: "upload://inline-2", alt: "new" } }]
          },
          "inline-2": filePart(pngFile("inline-2"), "image/png", "png")
        })
      )

      expect(wasCreated).toBe(false)
      expect(translation.id).toBe(row.id)
      expect(translation.locale).toBe("en")
      expect(translation.title).toBe("Fresh title")
      expect(translation.cover.endsWith(`/${row.coverKey}`)).toBe(true)
      expect(objects.has(row.coverKey)).toBe(true)
      expect(objects.has(dropKey)).toBe(false)
      expect(objects.size).toBe(2)
      // SAFETY: the upsert stored exactly one translation payload
      const stored = translationInsert.values.mock.calls[0]?.[0] as { content: RichText }
      expect(JSON.stringify(stored.content)).not.toContain("upload://")
    })

    test("creates a fresh locale translation without touching the cover", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow({ status: "published", publishedAt: faker.date.recent() })
      await seedStoredObject(storage, row.coverKey)
      const translationInsert = insertHandle<InsertedTranslation>(values => values)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row])).mockReturnValueOnce(selectChain([]))
      tx.insert.mockReturnValueOnce({ values: translationInsert.values })
      spyTransaction(tx.handles)

      const { translation, created: wasCreated } = await service.upsertTranslation(
        { id: row.id, locale: "id" },
        createUpsertBody()
      )

      expect(wasCreated).toBe(true)
      expect(translation.id).toBe(row.id)
      expect(translation.locale).toBe("id")
      expect(objects.has(row.coverKey)).toBe(true)
      expect(objects.size).toBe(1)
    })

    test("maps the stored author into the translation response", async () => {
      const { storage } = createTestStorage()
      const service = new ArticleService(database, storage)
      const author = createAuthorRow()
      const row = articleRow({ authorId: author.authorId })
      const translationInsert = insertHandle<InsertedTranslation>(values => values)
      const tx = createTransaction()
      tx.select
        .mockReturnValueOnce(selectChain([row]))
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([author]))
      tx.insert.mockReturnValueOnce({ values: translationInsert.values })
      spyTransaction(tx.handles)

      const { translation } = await service.upsertTranslation({ id: row.id, locale: "en" }, createUpsertBody())

      expect(translation.author).toEqual({
        id: author.authorId,
        name: author.authorName,
        image: author.authorImage
      })
    })

    test("forwards the abort signal to inline uploads", async () => {
      const storage = mockDeep<Storage>()
      storage.upload.mockResolvedValue({ key: "articles/a.png" })
      const controller = new AbortController()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row])).mockReturnValueOnce(selectChain([]))
      tx.insert.mockReturnValueOnce({ values: insertHandle<InsertedTranslation>(values => values).values })
      spyTransaction(tx.handles)

      await service.upsertTranslation(
        { id: row.id, locale: "en" },
        createUpsertBody({
          content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://inline-1" } }] },
          "inline-1": filePart(jpegFile("inline-1"), "image/jpeg", "jpg")
        }),
        controller.signal
      )

      expect(storage.upload).toHaveBeenCalledTimes(1)
      for (const call of storage.upload.mock.calls) expect(call[0].signal).toBe(controller.signal)
    })

    test("answers not-found for an unknown article id, deleting the uploaded inline images", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([]))
      tx.insert.mockReturnValueOnce({ values: insertHandle<InsertedTranslation>(values => values).values })
      spyTransaction(tx.handles)

      const error = await service
        .upsertTranslation(
          { id: faker.string.uuid({ version: 7 }), locale: "en" },
          createUpsertBody({
            content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://inline-1" } }] },
            "inline-1": filePart(pngFile("inline-1"), "image/png", "png")
          })
        )
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).status).toBe(404)
      expect(objects.size).toBe(0)
    })

    test("surfaces a per-locale slug collision as a 409 conflict, compensating new uploads", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      vi.spyOn(database, "transaction").mockRejectedValue(wrappedError("23505"))

      const error = await service
        .upsertTranslation(
          { id: faker.string.uuid({ version: 7 }), locale: "en" },
          createUpsertBody({
            content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://inline-1" } }] },
            "inline-1": filePart(pngFile("inline-1"), "image/png", "png")
          })
        )
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(ConflictError)
      // SAFETY: error is ConflictError per previous expect
      expect((error as ConflictError).status).toBe(409)
      // SAFETY: error is ConflictError per previous expect
      expect((error as ConflictError).message).toBe("Slug already exists")
      expect(objects.size).toBe(0)
    })

    test("rejects a placeholder without a matching file, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      spyTransaction(tx.handles)

      const payload = validationPayload(
        await service
          .upsertTranslation(
            { id: faker.string.uuid({ version: 7 }), locale: "en" },
            createUpsertBody({
              content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://ghost" } }] }
            })
          )
          .catch((error: unknown) => error)
      )

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["content"], message: expect.stringContaining("ghost") })
      ])
      expect(tx.insert).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })

    test("rejects a file without a matching placeholder, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      spyTransaction(tx.handles)

      const payload = validationPayload(
        await service
          .upsertTranslation(
            { id: faker.string.uuid({ version: 7 }), locale: "en" },
            createUpsertBody({ stray: filePart(pngFile("stray.png"), "image/png", "png") })
          )
          .catch((error: unknown) => error)
      )

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["stray"], message: expect.stringContaining("stray") })
      ])
      expect(tx.insert).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })

    test("rejects cover data sent to the translation endpoint, persisting nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      spyTransaction(tx.handles)

      const payload = validationPayload(
        await service
          .upsertTranslation(
            { id: faker.string.uuid({ version: 7 }), locale: "en" },
            createUpsertBody({ cover: filePart(pngFile("cover.png"), "image/png", "png") })
          )
          .catch((error: unknown) => error)
      )

      expect(payload.errors).toEqual([
        expect.objectContaining({ path: ["cover"], message: expect.stringContaining("cover") })
      ])
      expect(tx.insert).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })
  })

  describe("updateArticle", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test("publishes a draft on the first transition, leaving translation and stored keys untouched", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      await seedStoredObject(storage, row.coverKey)
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      const result = await service.updateArticle({ id: row.id }, { status: "published" })

      expect(result).toEqual({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: expect.any(Date),
        status: "published",
        publishedAt: expect.any(Date),
        categoryId: null,
        cover: expect.stringMatching(/^https?:\/\//),
        author: null
      })
      // SAFETY: update() received exactly one change payload
      const changes = update.set.mock.calls[0]?.[0] as { status: string; publishedAt: Date }
      expect(changes.status).toBe("published")
      expect(changes.publishedAt).toBeInstanceOf(Date)
      expect(objects.has(row.coverKey)).toBe(true)
      expect(objects.size).toBe(1)
    })

    test("keeps the first publishedAt when the status changes again", async () => {
      const firstPublishedAt = faker.date.recent()
      const row = articleRow({ status: "archived", publishedAt: firstPublishedAt })
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)
      const service = new ArticleService(database, mockDeep<Storage>())

      const result = await service.updateArticle({ id: row.id }, { status: "published" })

      expect(result.publishedAt?.getTime()).toBe(firstPublishedAt.getTime())
      // SAFETY: update() received exactly one change payload
      const changes = update.set.mock.calls[0]?.[0] as Partial<ArticleChanges>
      expect(changes).not.toHaveProperty("publishedAt")
    })

    test("reassigns and unassigns the article category without touching the translation", async () => {
      const service = new ArticleService(database, mockDeep<Storage>())
      const row = articleRow({ status: "published", publishedAt: faker.date.recent() })
      const categoryId = faker.string.uuid({ version: 7 })
      const assign = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const unassign = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const assignTx = createTransaction()
      assignTx.select.mockReturnValueOnce(selectChain([row]))
      assignTx.update.mockReturnValueOnce({ set: assign.set })
      const unassignTx = createTransaction()
      unassignTx.select.mockReturnValueOnce(selectChain([row]))
      unassignTx.update.mockReturnValueOnce({ set: unassign.set })
      const transaction = vi.spyOn(database, "transaction")
      // SAFETY: tx handles mirror the drizzle transaction handle the service receives
      transaction.mockImplementationOnce(async callback => callback(assignTx.handles as never))
      // SAFETY: tx handles mirror the drizzle transaction handle the service receives
      transaction.mockImplementationOnce(async callback => callback(unassignTx.handles as never))

      const assigned = await service.updateArticle({ id: row.id }, { categoryId })
      const unassigned = await service.updateArticle({ id: row.id }, { categoryId: null })

      expect(assigned.categoryId).toBe(categoryId)
      expect(unassigned.categoryId).toBeNull()
      // SAFETY: each update() received exactly one change payload
      const assignChanges = assign.set.mock.calls[0]?.[0] as Partial<ArticleChanges>
      // SAFETY: each update() received exactly one change payload
      const unassignChanges = unassign.set.mock.calls[0]?.[0] as Partial<ArticleChanges>
      expect(assignChanges.categoryId).toBe(categoryId)
      expect(unassignChanges.categoryId).toBeNull()
    })

    test("reassigns the author and returns the resolved author", async () => {
      const service = new ArticleService(database, mockDeep<Storage>())
      const row = articleRow({ status: "published", publishedAt: faker.date.recent() })
      const author = createAuthorRow()
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row])).mockReturnValueOnce(selectChain([author]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      const result = await service.updateArticle({ id: row.id }, { authorId: author.authorId })

      expect(result.author).toEqual({
        id: author.authorId,
        name: author.authorName,
        image: author.authorImage
      })
      // SAFETY: update() received exactly one change payload
      const changes = update.set.mock.calls[0]?.[0] as Partial<ArticleChanges>
      expect(changes.authorId).toBe(author.authorId)
    })

    test("returns the stored author when the patch leaves it untouched", async () => {
      const service = new ArticleService(database, mockDeep<Storage>())
      const author = createAuthorRow()
      const row = articleRow({ authorId: author.authorId })
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row])).mockReturnValueOnce(selectChain([author]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      const result = await service.updateArticle({ id: row.id }, { status: "published" })

      expect(result.author).toEqual({
        id: author.authorId,
        name: author.authorName,
        image: author.authorImage
      })
      // SAFETY: update() received exactly one change payload
      const changes = update.set.mock.calls[0]?.[0] as Partial<ArticleChanges>
      expect(changes).not.toHaveProperty("authorId")
    })

    test("rejects an unknown author id with a 404, leaving the article untouched", async () => {
      const service = new ArticleService(database, mockDeep<Storage>())
      const row = articleRow()
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row])).mockReturnValueOnce(selectChain([]))
      spyTransaction(tx.handles)

      const error = await service
        .updateArticle({ id: row.id }, { authorId: faker.string.uuid({ version: 7 }) })
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).status).toBe(404)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).message).toBe("Author not found")
      expect(tx.update).not.toHaveBeenCalled()
    })

    test("keeps the stored cover byte-identical when no cover part is supplied", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow({ status: "published", publishedAt: faker.date.recent() })
      await seedStoredObject(storage, row.coverKey)
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      const result = await service.updateArticle({ id: row.id }, { status: "archived" })

      expect(objects.has(row.coverKey)).toBe(true)
      expect(objects.size).toBe(1)
      expect(result.cover.endsWith(`/${row.coverKey}`)).toBe(true)
    })

    test("replaces the cover, deleting the superseded stored key", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      await seedStoredObject(storage, row.coverKey)
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      const result = await service.updateArticle(
        { id: row.id },
        { cover: filePart(jpegFile("new.jpg"), "image/jpeg", "jpg") }
      )

      // SAFETY: update() received exactly one change payload
      const changes = update.set.mock.calls[0]?.[0] as { coverKey: string }
      expect(changes.coverKey).not.toBe(row.coverKey)
      expect(changes.coverKey).toMatch(/^articles\/.+\.jpg$/)
      expect(objects.has(row.coverKey)).toBe(false)
      expect(objects.has(changes.coverKey)).toBe(true)
      expect(objects.size).toBe(1)
      expect(result.cover.endsWith(`/${changes.coverKey}`)).toBe(true)
    })

    test("answers not-found for an unknown article id, uploading nothing", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([]))
      spyTransaction(tx.handles)

      const error = await service
        .updateArticle({ id: faker.string.uuid({ version: 7 }) }, { status: "published" })
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).status).toBe(404)
      expect(tx.update).not.toHaveBeenCalled()
      expect(objects.size).toBe(0)
    })

    test("rejects an unknown category id with a 404, deleting the uploaded cover", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      await seedStoredObject(storage, row.coverKey)
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      update.returning.mockRejectedValueOnce(wrappedError("23503"))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      const error = await service
        .updateArticle(
          { id: row.id },
          { categoryId: faker.string.uuid({ version: 7 }), cover: filePart(pngFile("new.png"), "image/png", "png") }
        )
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).message).toBe("Category not found")
      expect(objects.has(row.coverKey)).toBe(true)
      expect(objects.size).toBe(1)
    })

    test("forwards the abort signal to the cover upload", async () => {
      const storage = mockDeep<Storage>()
      storage.upload.mockResolvedValue({ key: "articles/a.png" })
      const controller = new AbortController()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      const update = updateHandle<ArticleChanges>(changes => ({ ...row, ...changes }))
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([row]))
      tx.update.mockReturnValueOnce({ set: update.set })
      spyTransaction(tx.handles)

      await service.updateArticle(
        { id: row.id },
        { cover: filePart(jpegFile("new.jpg"), "image/jpeg", "jpg") },
        controller.signal
      )

      expect(storage.upload).toHaveBeenCalledTimes(1)
      for (const call of storage.upload.mock.calls) expect(call[0].signal).toBe(controller.signal)
    })
  })

  describe("delete", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test("removes the article row and every stored key", async () => {
      const { storage, objects } = createTestStorage()
      const service = new ArticleService(database, storage)
      const row = articleRow()
      const inlineKeys = [
        `articles/${faker.string.uuid({ version: 7 })}.jpg`,
        `articles/${faker.string.uuid({ version: 7 })}.png`
      ]
      await seedStoredObject(storage, row.coverKey)
      for (const key of inlineKeys) await seedStoredObject(storage, key)
      expect(objects.size).toBe(3)
      const contents: RichText[] = inlineKeys.map(key => ({
        type: "doc",
        content: [{ type: "image", attrs: { src: key } }]
      }))
      const tx = createTransaction()
      tx.select
        .mockReturnValueOnce(selectChain([{ coverKey: row.coverKey }]))
        .mockReturnValueOnce(selectChain(contents.map(content => ({ content }))))
      tx.remove.mockReturnValueOnce({ where: deleteHandle().where })
      spyTransaction(tx.handles)

      await service.delete({ id: row.id })

      expect(tx.remove).toHaveBeenCalledWith(articles)
      expect(objects.size).toBe(0)
    })

    test("answers not-found for an unknown article id, deleting nothing", async () => {
      const { storage, objects } = createTestStorage()
      await seedStoredObject(storage, `articles/${faker.string.uuid({ version: 7 })}.png`)
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      tx.select.mockReturnValueOnce(selectChain([]))
      spyTransaction(tx.handles)

      const error = await service.delete({ id: faker.string.uuid({ version: 7 }) }).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(NotFoundError)
      // SAFETY: error is NotFoundError per previous expect
      expect((error as NotFoundError).status).toBe(404)
      expect(tx.remove).not.toHaveBeenCalled()
      expect(objects.size).toBe(1)
    })

    test("keeps deleted identifiers not-found on subsequent reads", async () => {
      const { storage } = createTestStorage()
      const row = articleRow()
      const service = new ArticleService(database, storage)
      const tx = createTransaction()
      tx.select
        .mockReturnValueOnce(selectChain([{ coverKey: row.coverKey }]))
        .mockReturnValueOnce(selectChain([]))
      tx.remove.mockReturnValueOnce({ where: deleteHandle().where })
      spyTransaction(tx.handles)

      await service.delete({ id: row.id })

      // SAFETY: the select chain stands in for the drizzle query builder consumed by getByIdentifier
      vi.spyOn(database, "select").mockReturnValueOnce(selectChain([]) as never)
      await expect(service.getByIdentifier(row.id, "en", true)).rejects.toThrow("Article not found")
    })
  })
})
