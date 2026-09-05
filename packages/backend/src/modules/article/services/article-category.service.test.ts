import { faker } from "@faker-js/faker"
import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { NotFoundError, ValidationError } from "elysia"
import { mockDeep } from "vitest-mock-extended"

import type { Database } from "../../../common/database.js"
import type {
  ArticleCategoryTranslationParams,
  CreateArticleCategoryBody,
  UpsertArticleCategoryTranslationBody
} from "../schemas/article-category.schema.js"
import { articleCategories, articleCategoryTranslations } from "../tables/article-category.table.js"
import { ArticleCategoryService } from "./article-category.service.js"

function createCategoryRow() {
  return {
    id: faker.string.uuid(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent()
  }
}

function createTranslationRow(
  overrides: Partial<{ locale: string; name: string; slug: string; description: string | null | undefined }> = {}
) {
  const locale = overrides.locale ?? faker.helpers.arrayElement(["en", "id"] as const)
  const name = overrides.name ?? faker.lorem.words({ min: 1, max: 3 })
  const slug = overrides.slug ?? faker.lorem.slug()
  const description = overrides.description === undefined ? faker.lorem.sentence() : overrides.description
  return {
    locale,
    name,
    slug,
    description
  }
}

function createCategoryInput(overrides: Partial<CreateArticleCategoryBody> = {}): CreateArticleCategoryBody {
  const locale = overrides.locale ?? faker.helpers.arrayElement(["en", "id"] as const)
  const name = overrides.name ?? faker.lorem.words({ min: 1, max: 3 })
  const slug = overrides.slug ?? faker.lorem.slug()
  const description = overrides.description ?? faker.lorem.sentence()
  return {
    locale,
    name,
    slug,
    description
  }
}

type CategoryRow = ReturnType<typeof createCategoryRow>
type TranslationRow = ReturnType<typeof createTranslationRow>

type ReturningCategory = ReturnType<typeof vi.fn<() => Promise<CategoryRow[]>>>
type ReturningTranslation = ReturnType<typeof vi.fn<() => Promise<TranslationRow[]>>>
type ReturningEmpty = ReturnType<typeof vi.fn<() => Promise<never[]>>>

interface Chain {
  values: ReturnType<typeof vi.fn>
}

function buildCategoryChain(row: CategoryRow) {
  const returning = vi.fn<() => Promise<CategoryRow[]>>().mockResolvedValue([row])
  const values = vi.fn<() => { returning: ReturningCategory }>().mockReturnValue({ returning })
  const chain: Chain = { values }
  return { chain, values, returning }
}

function buildTranslationChain(row: TranslationRow) {
  const returning = vi.fn<() => Promise<TranslationRow[]>>().mockResolvedValue([row])
  const values = vi.fn<() => { returning: ReturningTranslation }>().mockReturnValue({ returning })
  const chain: Chain = { values }
  return { chain, values, returning }
}

function buildEmptyChain() {
  const returning = vi.fn<() => Promise<never[]>>().mockResolvedValue([])
  const values = vi.fn<() => { returning: ReturningEmpty }>().mockReturnValue({ returning })
  const chain: Chain = { values }
  return { chain, values, returning }
}

function mockDelete(database: Database, chain: { where: ReturnType<typeof vi.fn> }): void {
  // SAFETY: mockDeep delete is a vitest mock with overloads, safe to cast to plain mock to override implementation
  const deleteMock = database.delete as ReturnType<typeof vi.fn>
  vi.mocked(deleteMock).mockReturnValue(chain)
}

function mockTransaction(database: Database, txMock: { insert: ReturnType<typeof vi.fn> }): void {
  // SAFETY: mockDeep transaction is a vitest mock, safe to override implementation for test
  const transactionMock = database.transaction as ReturnType<typeof vi.fn>
  vi.mocked(transactionMock).mockImplementation(
    async (callback: (tx: typeof txMock) => Promise<Record<string, string>>) => {
      return callback(txMock)
    }
  )
}

interface ListRow {
  id: string
  createdAt: Date
  updatedAt: Date
  locale: string
  name: string
  slug: string
  description: string | null
}

function createListRow(overrides: Partial<ListRow> = {}): ListRow {
  return {
    id: overrides.id ?? faker.string.uuid(),
    createdAt: overrides.createdAt ?? faker.date.recent(),
    updatedAt: overrides.updatedAt ?? faker.date.recent(),
    locale: overrides.locale ?? faker.helpers.arrayElement(["en", "id"] as const),
    name: overrides.name ?? faker.lorem.words({ min: 1, max: 3 }),
    slug: overrides.slug ?? faker.lorem.slug(),
    description: overrides.description === undefined ? faker.lorem.sentence() : overrides.description
  }
}

function buildRowsChain(rows: ListRow[]) {
  const offset = vi.fn<(offset: number) => Promise<ListRow[]>>().mockResolvedValue(rows)
  const limit = vi.fn<(limit: number) => { offset: typeof offset }>().mockReturnValue({ offset })
  const orderBy = vi.fn<() => { limit: typeof limit }>().mockReturnValue({ limit })
  const where = vi.fn<() => { orderBy: typeof orderBy }>().mockReturnValue({ orderBy })
  const innerJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, where, orderBy, limit, offset }
}

function buildCountChain(total: number) {
  const where = vi.fn<() => Promise<{ value: number }[]>>().mockResolvedValue([{ value: total }])
  const innerJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, where }
}

function mockListSelect(database: Database, rows: ListRow[], total: number) {
  const rowsChain = buildRowsChain(rows)
  const countChain = buildCountChain(total)
  // SAFETY: drizzle select chain is mocked for unit test; return shape matches service usage
  const rowsChainMock = rowsChain as never
  // SAFETY: drizzle count chain is mocked for unit test; return shape matches service usage
  const countChainMock = countChain as never
  vi.mocked(database.select).mockReturnValueOnce(rowsChainMock).mockReturnValueOnce(countChainMock)
  return { rowsChain, countChain }
}

function buildDeleteChain<T>(rows: T[]) {
  const returning = vi.fn<() => Promise<T[]>>().mockResolvedValue(rows)
  const where = vi.fn<() => { returning: typeof returning }>().mockReturnValue({ returning })
  return { where, returning }
}

function buildSelectLimitChain<T>(rows: T[]) {
  const limit = vi.fn<(limit: number) => Promise<T[]>>().mockResolvedValue(rows)
  const where = vi.fn<() => { limit: typeof limit }>().mockReturnValue({ limit })
  const from = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  return { from, where, limit }
}

function buildUpsertChain<T>(row: T) {
  const returning = vi.fn<() => Promise<T[]>>().mockResolvedValue([row])
  const onConflictDoUpdate = vi.fn<() => { returning: typeof returning }>().mockReturnValue({ returning })
  const values = vi
    .fn<() => { onConflictDoUpdate: typeof onConflictDoUpdate }>()
    .mockReturnValue({ onConflictDoUpdate })
  return { values, onConflictDoUpdate, returning }
}

function buildJoinedLimitChain(rows: ListRow[]) {
  const limit = vi.fn<(limit: number) => Promise<ListRow[]>>().mockResolvedValue(rows)
  const where = vi.fn<(predicate: unknown) => { limit: typeof limit }>().mockReturnValue({ limit })
  const innerJoin = vi.fn<() => { where: typeof where }>().mockReturnValue({ where })
  const from = vi.fn<() => { innerJoin: typeof innerJoin }>().mockReturnValue({ innerJoin })
  return { from, innerJoin, where, limit }
}

const pgDialect = new PgDialect()

function renderPredicate(whereCall: unknown): string {
  // SAFETY: the where() argument is always a drizzle SQL instance built by the service
  return pgDialect.sqlToQuery(whereCall as SQL).sql
}

function createUpsertParams(
  overrides: Partial<ArticleCategoryTranslationParams> = {}
): ArticleCategoryTranslationParams {
  return {
    id: overrides.id ?? faker.string.uuid(),
    locale: overrides.locale ?? faker.helpers.arrayElement(["en", "id"] as const)
  }
}

function createUpsertBody(
  overrides: Partial<UpsertArticleCategoryTranslationBody> = {}
): UpsertArticleCategoryTranslationBody {
  return {
    name: overrides.name ?? faker.lorem.words({ min: 1, max: 3 }),
    slug: overrides.slug ?? faker.lorem.slug(),
    description: overrides.description === undefined ? faker.lorem.sentence() : overrides.description
  }
}

describe("ArticleCategoryService", () => {
  describe("create", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    test("creates category and translation successfully and maps dto", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const input = createCategoryInput()
      const translationRow = createTranslationRow({
        locale: input.locale,
        name: input.name,
        slug: input.slug,
        description: input.description
      })

      const category = buildCategoryChain(categoryRow)
      const translation = buildTranslationChain(translationRow)

      const txMock = {
        insert: vi
          .fn<(table: unknown) => Chain>()
          .mockReturnValueOnce(category.chain)
          .mockReturnValueOnce(translation.chain)
      }

      mockTransaction(database, txMock)

      const service = new ArticleCategoryService(database)
      const result = await service.create(input)

      expect(result).toEqual({
        id: categoryRow.id,
        createdAt: categoryRow.createdAt,
        updatedAt: categoryRow.updatedAt,
        locale: translationRow.locale,
        name: translationRow.name,
        slug: translationRow.slug,
        description: translationRow.description
      })

      expect(database.transaction).toHaveBeenCalledTimes(1)
      expect(txMock.insert).toHaveBeenCalledTimes(2)
      expect(txMock.insert).toHaveBeenNthCalledWith(1, articleCategories)
      expect(txMock.insert).toHaveBeenNthCalledWith(2, articleCategoryTranslations)
      expect(category.values).toHaveBeenCalledWith({})
      expect(translation.values).toHaveBeenCalledWith({
        categoryId: categoryRow.id,
        locale: input.locale,
        name: input.name,
        slug: input.slug,
        description: input.description
      })
    })

    test("returns description as undefined when translation description is null", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const input = createCategoryInput({ description: faker.lorem.sentence() })
      const translationRow = createTranslationRow({
        locale: input.locale,
        name: input.name,
        slug: input.slug,
        description: null
      })

      const category = buildCategoryChain(categoryRow)
      const translation = buildTranslationChain(translationRow)

      const txMock = {
        insert: vi
          .fn<(table: unknown) => Chain>()
          .mockReturnValueOnce(category.chain)
          .mockReturnValueOnce(translation.chain)
      }

      mockTransaction(database, txMock)

      const service = new ArticleCategoryService(database)
      const result = await service.create(input)

      expect(result.description).toBeUndefined()
    })

    test("returns description when provided", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const description = faker.lorem.sentence()
      const input = createCategoryInput({ description })
      const translationRow = createTranslationRow({
        locale: input.locale,
        name: input.name,
        slug: input.slug,
        description
      })

      const category = buildCategoryChain(categoryRow)
      const translation = buildTranslationChain(translationRow)

      const txMock = {
        insert: vi
          .fn<(table: unknown) => Chain>()
          .mockReturnValueOnce(category.chain)
          .mockReturnValueOnce(translation.chain)
      }

      mockTransaction(database, txMock)

      const service = new ArticleCategoryService(database)
      const result = await service.create(input)

      expect(result.description).toBe(description)
    })

    test("throws when category insert returns empty", async () => {
      const database = mockDeep<Database>()
      const input = createCategoryInput()

      const empty = buildEmptyChain()
      const txMock = {
        insert: vi.fn<(table: unknown) => Chain>().mockReturnValue(empty.chain)
      }

      mockTransaction(database, txMock)

      const service = new ArticleCategoryService(database)

      await expect(service.create(input)).rejects.toThrow("Failed to create article category")
    })

    test("throws when translation insert returns empty", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const input = createCategoryInput()

      const category = buildCategoryChain(categoryRow)
      const empty = buildEmptyChain()

      const txMock = {
        insert: vi.fn<(table: unknown) => Chain>().mockReturnValueOnce(category.chain).mockReturnValueOnce(empty.chain)
      }

      mockTransaction(database, txMock)

      const service = new ArticleCategoryService(database)

      await expect(service.create(input)).rejects.toThrow("Failed to create article category translation")
    })

    test("propagates transaction rejection", async () => {
      const database = mockDeep<Database>()
      const input = createCategoryInput()
      const error = new Error(faker.lorem.sentence())

      vi.mocked(database.transaction).mockRejectedValue(error)

      const service = new ArticleCategoryService(database)

      await expect(service.create(input)).rejects.toThrow(error)
    })

    test("maps a 23505 unique violation race to ValidationError", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const input = createCategoryInput()
      const translationRow = createTranslationRow({
        locale: input.locale,
        name: input.name,
        slug: input.slug,
        description: input.description
      })

      const category = buildCategoryChain(categoryRow)
      const translation = buildTranslationChain(translationRow)

      const txMock = {
        insert: vi
          .fn<(table: unknown) => Chain>()
          .mockReturnValueOnce(category.chain)
          .mockReturnValueOnce(translation.chain)
      }

      mockTransaction(database, txMock)
      translation.returning.mockRejectedValue(Object.assign(new Error("duplicate key value"), { code: "23505" }))

      const service = new ArticleCategoryService(database)

      try {
        await service.create(input)
        expect.unreachable("should throw ValidationError")
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        // SAFETY: error is ValidationError per previous expect
        expect((error as ValidationError).status).toBe(422)
        // SAFETY: error is ValidationError per previous expect
        expect((error as ValidationError).message).toContain("Slug already exists")
      }
    })

    test("calls insert with empty values for category", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const input = createCategoryInput()
      const translationRow = createTranslationRow({
        locale: input.locale,
        name: input.name,
        slug: input.slug,
        description: input.description
      })

      const category = buildCategoryChain(categoryRow)
      const translation = buildTranslationChain(translationRow)

      const txMock = {
        insert: vi
          .fn<(table: unknown) => Chain>()
          .mockReturnValueOnce(category.chain)
          .mockReturnValueOnce(translation.chain)
      }

      mockTransaction(database, txMock)

      const service = new ArticleCategoryService(database)
      await service.create(input)

      expect(category.values).toHaveBeenCalledWith({})
      expect(category.values).toHaveBeenCalledTimes(1)
      expect(txMock.insert).toHaveBeenCalledWith(articleCategories)
    })
  })

  describe("upsertTranslation", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    function setupUpsert(
      database: Database,
      categoryRows: { id: string; createdAt: Date; updatedAt: Date }[],
      currentRows: { id: string }[],
      upsert: ReturnType<typeof buildUpsertChain>
    ) {
      const categoryChain = buildSelectLimitChain(categoryRows)
      const currentChain = buildSelectLimitChain(currentRows)
      const txMock = {
        insert: vi
          .fn<(table: unknown) => { values: typeof upsert.values }>()
          .mockReturnValue({ values: upsert.values }),
        select: vi
          .fn<(query: unknown) => { from: unknown }>()
          .mockReturnValueOnce({ from: categoryChain.from })
          .mockReturnValueOnce({ from: currentChain.from })
      }
      mockTransaction(database, txMock)
      return txMock
    }

    test("inserts a new translation and reports created", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const params = createUpsertParams({ id: categoryRow.id })
      const body = createUpsertBody()
      const savedRow = createTranslationRow({
        locale: params.locale,
        name: body.name,
        slug: body.slug,
        description: body.description
      })
      const upsert = buildUpsertChain(savedRow)

      setupUpsert(database, [categoryRow], [], upsert)

      const service = new ArticleCategoryService(database)
      const { translation, created } = await service.upsertTranslation(params, body)

      expect(created).toBe(true)
      expect(translation).toEqual({
        id: categoryRow.id,
        createdAt: categoryRow.createdAt,
        updatedAt: categoryRow.updatedAt,
        locale: savedRow.locale,
        name: savedRow.name,
        slug: savedRow.slug,
        description: savedRow.description
      })
      expect(upsert.values).toHaveBeenCalledWith({
        categoryId: categoryRow.id,
        locale: params.locale,
        name: body.name,
        slug: body.slug,
        description: body.description
      })
      expect(upsert.onConflictDoUpdate).toHaveBeenCalledWith({
        target: [articleCategoryTranslations.categoryId, articleCategoryTranslations.locale],
        set: { name: body.name, slug: body.slug, description: body.description ?? null }
      })
    })

    test("replaces an existing row keeping its own slug and reports not created", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const params = createUpsertParams({ id: categoryRow.id, locale: "en" })
      const body = createUpsertBody()
      const currentRowId = faker.string.uuid()
      const savedRow = createTranslationRow({ locale: params.locale, name: body.name, slug: body.slug })
      const upsert = buildUpsertChain(savedRow)

      setupUpsert(database, [categoryRow], [{ id: currentRowId }], upsert)

      const service = new ArticleCategoryService(database)
      const { created } = await service.upsertTranslation(params, body)

      expect(created).toBe(false)
    })

    test("clears description when omitted from the body", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const params = createUpsertParams({ id: categoryRow.id })
      const body = createUpsertBody()
      delete body.description
      const savedRow = createTranslationRow({ locale: params.locale, name: body.name, slug: body.slug })
      const upsert = buildUpsertChain(savedRow)

      setupUpsert(database, [categoryRow], [], upsert)

      const service = new ArticleCategoryService(database)
      await service.upsertTranslation(params, body)

      expect(upsert.values).toHaveBeenCalledWith({
        categoryId: categoryRow.id,
        locale: params.locale,
        name: body.name,
        slug: body.slug,
        description: undefined
      })
      expect(upsert.onConflictDoUpdate).toHaveBeenCalledWith({
        target: [articleCategoryTranslations.categoryId, articleCategoryTranslations.locale],
        set: { name: body.name, slug: body.slug, description: null }
      })
    })

    test("throws NotFoundError when the category does not exist", async () => {
      const database = mockDeep<Database>()
      const params = createUpsertParams()
      const body = createUpsertBody()
      const upsert = buildUpsertChain(createTranslationRow({ locale: params.locale }))

      const txMock = setupUpsert(database, [], [], upsert)

      const service = new ArticleCategoryService(database)

      await expect(service.upsertTranslation(params, body)).rejects.toBeInstanceOf(NotFoundError)
      expect(txMock.insert).not.toHaveBeenCalled()
    })

    test("maps a 23505 unique violation race to ValidationError", async () => {
      const database = mockDeep<Database>()
      const categoryRow = createCategoryRow()
      const params = createUpsertParams({ id: categoryRow.id })
      const body = createUpsertBody()
      const upsert = buildUpsertChain(createTranslationRow({ locale: params.locale }))

      setupUpsert(database, [categoryRow], [], upsert)
      upsert.returning.mockRejectedValue(Object.assign(new Error("duplicate key value"), { code: "23505" }))

      const service = new ArticleCategoryService(database)

      try {
        await service.upsertTranslation(params, body)
        expect.unreachable("should throw ValidationError")
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        // SAFETY: error is ValidationError per previous expect
        expect((error as ValidationError).message).toContain("Slug already exists")
      }
    })
  })

  describe("list", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    test("returns paginated data with correct mapping and meta", async () => {
      const database = mockDeep<Database>()
      const row1 = createListRow()
      const row2 = createListRow()
      const total = faker.number.int({ min: 5, max: 20 })
      const query = { page: 1, limit: 2 }

      mockListSelect(database, [row1, row2], total)

      const service = new ArticleCategoryService(database)
      const result = await service.list(query, "en")

      expect(result.data).toEqual([
        {
          id: row1.id,
          createdAt: row1.createdAt,
          updatedAt: row1.updatedAt,
          locale: row1.locale,
          name: row1.name,
          slug: row1.slug,
          description: row1.description ?? undefined
        },
        {
          id: row2.id,
          createdAt: row2.createdAt,
          updatedAt: row2.updatedAt,
          locale: row2.locale,
          name: row2.name,
          slug: row2.slug,
          description: row2.description ?? undefined
        }
      ])
      expect(result.meta).toEqual({
        page: 1,
        limit: 2,
        total,
        totalPages: Math.ceil(total / 2)
      })
    })

    test("maps null description to undefined", async () => {
      const database = mockDeep<Database>()
      const row = createListRow({ description: null })
      mockListSelect(database, [row], 1)

      const service = new ArticleCategoryService(database)
      const result = await service.list({ page: 1, limit: 10 }, "en")

      expect(result.data[0]?.description).toBeUndefined()
    })

    test("preserves description when provided", async () => {
      const database = mockDeep<Database>()
      const description = faker.lorem.sentence()
      const row = createListRow({ description })
      mockListSelect(database, [row], 1)

      const service = new ArticleCategoryService(database)
      const result = await service.list({ page: 1, limit: 10 }, "en")

      expect(result.data[0]?.description).toBe(description)
    })

    test("returns empty data and zero pagination when no rows", async () => {
      const database = mockDeep<Database>()
      mockListSelect(database, [], 0)

      const service = new ArticleCategoryService(database)
      const result = await service.list({ page: 1, limit: 20 }, "en")

      expect(result.data).toEqual([])
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      })
    })

    test("calculates totalPages correctly when divisible", async () => {
      const database = mockDeep<Database>()
      mockListSelect(database, [], 20)

      const service = new ArticleCategoryService(database)
      const result = await service.list({ page: 1, limit: 10 }, "en")

      expect(result.meta.totalPages).toBe(2)
    })

    test("calculates totalPages correctly with remainder", async () => {
      const database = mockDeep<Database>()
      mockListSelect(database, [], 25)

      const service = new ArticleCategoryService(database)
      const result = await service.list({ page: 1, limit: 10 }, "en")

      expect(result.meta.totalPages).toBe(3)
    })

    test("applies correct limit and offset for page 1", async () => {
      const database = mockDeep<Database>()
      const { rowsChain } = mockListSelect(database, [], 0)

      const service = new ArticleCategoryService(database)
      await service.list({ page: 1, limit: 10 }, "en")

      expect(rowsChain.limit).toHaveBeenCalledWith(10)
      expect(rowsChain.offset).toHaveBeenCalledWith(0)
    })

    test("applies correct offset for page 2", async () => {
      const database = mockDeep<Database>()
      const { rowsChain } = mockListSelect(database, [], 0)

      const service = new ArticleCategoryService(database)
      await service.list({ page: 2, limit: 5 }, "en")

      expect(rowsChain.limit).toHaveBeenCalledWith(5)
      expect(rowsChain.offset).toHaveBeenCalledWith(5)
    })

    test("applies correct offset for page 3", async () => {
      const database = mockDeep<Database>()
      const { rowsChain } = mockListSelect(database, [], 0)

      const service = new ArticleCategoryService(database)
      await service.list({ page: 3, limit: 20 }, "en")

      expect(rowsChain.limit).toHaveBeenCalledWith(20)
      expect(rowsChain.offset).toHaveBeenCalledWith(40)
    })

    test("queries both data and count in parallel", async () => {
      const database = mockDeep<Database>()
      mockListSelect(database, [createListRow()], 1)

      const service = new ArticleCategoryService(database)
      await service.list({ page: 1, limit: 10 }, "en")

      expect(database.select).toHaveBeenCalledTimes(2)
    })

    test("selects from articleCategories", async () => {
      const database = mockDeep<Database>()
      const { rowsChain, countChain } = mockListSelect(database, [], 0)

      const service = new ArticleCategoryService(database)
      await service.list({ page: 1, limit: 10 }, "en")

      expect(rowsChain.from).toHaveBeenCalledWith(articleCategories)
      expect(countChain.from).toHaveBeenCalledWith(articleCategories)
    })
  })

  describe("getByIdentifier", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    function mockJoinedSelect(database: Database, rows: ListRow[]) {
      const chain = buildJoinedLimitChain(rows)
      // SAFETY: drizzle select chain is mocked for unit test; return shape matches service usage
      vi.mocked(database.select).mockReturnValueOnce(chain as never)
      return chain
    }

    function mockJoinedSelectAndProbe(database: Database, rows: ListRow[], probeRows: { id: string }[]) {
      const joinChain = buildJoinedLimitChain(rows)
      const probeChain = buildSelectLimitChain(probeRows)
      // SAFETY: drizzle select chains are mocked for unit test; return shapes match service usage
      vi.mocked(database.select)
        .mockReturnValueOnce(joinChain as never)
        .mockReturnValueOnce(probeChain as never)
      return { joinChain, probeChain }
    }

    test("resolves a uuidv7 identifier through id and locale predicates", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      const row = createListRow({ id })
      const chain = mockJoinedSelect(database, [row])

      const service = new ArticleCategoryService(database)
      const result = await service.getByIdentifier(id, "en")

      expect(result).toEqual({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        locale: row.locale,
        name: row.name,
        slug: row.slug,
        description: row.description ?? undefined
      })
      expect(chain.from).toHaveBeenCalledWith(articleCategories)
      expect(chain.limit).toHaveBeenCalledWith(1)
      const sql = renderPredicate(chain.where.mock.calls[0]?.[0])
      expect(sql).toContain(`"article_categories"."id"`)
      expect(sql).toContain(`"article_category_translations"."locale"`)
      expect(sql).not.toContain(`"article_category_translations"."slug"`)
    })

    test("resolves a slug identifier through locale and slug predicates", async () => {
      const database = mockDeep<Database>()
      const slug = faker.lorem.slug()
      const row = createListRow({ slug })
      const chain = mockJoinedSelect(database, [row])

      const service = new ArticleCategoryService(database)
      const result = await service.getByIdentifier(slug, "id")

      expect(result.slug).toBe(slug)
      expect(chain.from).toHaveBeenCalledWith(articleCategories)
      expect(chain.limit).toHaveBeenCalledWith(1)
      const sql = renderPredicate(chain.where.mock.calls[0]?.[0])
      expect(sql).toContain(`"article_category_translations"."locale"`)
      expect(sql).toContain(`"article_category_translations"."slug"`)
      expect(sql).not.toContain(`"article_categories"."id"`)
    })

    test("maps null description to undefined", async () => {
      const database = mockDeep<Database>()
      const row = createListRow({ description: null })
      mockJoinedSelect(database, [row])

      const service = new ArticleCategoryService(database)
      const result = await service.getByIdentifier(row.slug, "en")

      expect(result.description).toBeUndefined()
    })

    test("throws generic NotFoundError when the id does not exist", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      mockJoinedSelectAndProbe(database, [], [])

      const service = new ArticleCategoryService(database)

      await expect(service.getByIdentifier(id, "en")).rejects.toThrow("Article category not found")
    })

    test("throws translation-specific NotFoundError when the category exists without the locale", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      mockJoinedSelectAndProbe(database, [], [{ id }])

      const service = new ArticleCategoryService(database)

      await expect(service.getByIdentifier(id, "id")).rejects.toThrow(
        "Article category translation not found for locale id"
      )
    })

    test("throws generic NotFoundError for an unknown slug without a follow-up probe", async () => {
      const database = mockDeep<Database>()
      mockJoinedSelect(database, [])

      const service = new ArticleCategoryService(database)

      await expect(service.getByIdentifier(`${faker.lorem.slug()}-missing`, "en")).rejects.toThrow(
        "Article category not found"
      )
      expect(database.select).toHaveBeenCalledTimes(1)
    })
  })

  describe("delete", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    test("deletes the category by id", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      const chain = buildDeleteChain([{ id }])

      mockDelete(database, chain)

      const service = new ArticleCategoryService(database)
      await service.delete({ id })

      expect(database.delete).toHaveBeenCalledWith(articleCategories)
      expect(chain.where).toHaveBeenCalled()
    })

    test("throws NotFoundError when no row is deleted", async () => {
      const database = mockDeep<Database>()
      const id = faker.string.uuid({ version: 7 })
      const chain = buildDeleteChain([])

      mockDelete(database, chain)

      const service = new ArticleCategoryService(database)

      await expect(service.delete({ id })).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
