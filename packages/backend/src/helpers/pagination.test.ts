import { faker } from "@faker-js/faker"
import { z } from "zod"

import { paginatedSchema, paginationMetaSchema, paginationQuerySchema } from "./pagination.js"

const sampleItemSchema = z.object({ id: z.string() })

function createMetaInput(overrides: Partial<z.input<typeof paginationMetaSchema>> = {}) {
  return {
    page: faker.number.int({ min: 1, max: 10 }),
    limit: faker.number.int({ min: 1, max: 100 }),
    total: faker.number.int({ min: 0, max: 1000 }),
    totalPages: faker.number.int({ min: 0, max: 50 }),
    ...overrides
  }
}

function issuePaths(error: z.ZodError) {
  return error.issues.map(issue => issue.path.join("."))
}

describe("paginationQuerySchema", () => {
  test("applies defaults for an empty query", () => {
    const result = paginationQuerySchema.safeParse({})

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ page: 1, limit: 20 })
    }
  })

  test("coerces string query values to numbers", () => {
    const result = paginationQuerySchema.safeParse({ page: "2", limit: "50" })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ page: 2, limit: 50 })
    }
  })

  test("rejects a page below 1", () => {
    const result = paginationQuerySchema.safeParse({ page: 0 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["page"])
    }
  })

  test("rejects a non-integer page", () => {
    const result = paginationQuerySchema.safeParse({ page: 1.5 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["page"])
    }
  })

  test("rejects a non-numeric page", () => {
    const result = paginationQuerySchema.safeParse({ page: faker.lorem.word() })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["page"])
    }
  })

  test("rejects a limit below 1", () => {
    const result = paginationQuerySchema.safeParse({ limit: 0 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["limit"])
    }
  })

  test("rejects a limit above 100", () => {
    const result = paginationQuerySchema.safeParse({ limit: 101 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["limit"])
    }
  })

  test("has descriptions on the root and every field", () => {
    expect(paginationQuerySchema.description).toBe("Pagination query parameters")

    const shape = paginationQuerySchema.shape
    expect(shape.page.description).toBe("Page number (1-indexed)")
    expect(shape.limit.description).toBe("Items per page")
  })
})

describe("paginationMetaSchema", () => {
  test("accepts a valid meta object", () => {
    const input = createMetaInput()

    const result = paginationMetaSchema.safeParse(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(input)
    }
  })

  test("accepts zero totals on an empty collection", () => {
    const result = paginationMetaSchema.safeParse(createMetaInput({ total: 0, totalPages: 0 }))

    expect(result.success).toBe(true)
  })

  test("rejects a page below 1", () => {
    const result = paginationMetaSchema.safeParse(createMetaInput({ page: 0 }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["page"])
    }
  })

  test("rejects a limit below 1", () => {
    const result = paginationMetaSchema.safeParse(createMetaInput({ limit: 0 }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["limit"])
    }
  })

  test("rejects a negative total", () => {
    const result = paginationMetaSchema.safeParse(createMetaInput({ total: -1 }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["total"])
    }
  })

  test("rejects a non-integer totalPages", () => {
    const result = paginationMetaSchema.safeParse(createMetaInput({ totalPages: 1.5 }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["totalPages"])
    }
  })

  test("rejects missing required fields", () => {
    const { total: _ignored, totalPages: _alsoIgnored, ...withoutTotals } = createMetaInput()

    const result = paginationMetaSchema.safeParse(withoutTotals)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error).sort()).toEqual(["total", "totalPages"])
    }
  })

  test("has descriptions on the root and every field", () => {
    expect(paginationMetaSchema.description).toBe("Pagination metadata")

    const shape = paginationMetaSchema.shape
    expect(shape.page.description).toBe("Current page number")
    expect(shape.limit.description).toBe("Items per page")
    expect(shape.total.description).toBe("Total number of items")
    expect(shape.totalPages.description).toBe("Total number of pages")
  })
})

describe("paginatedSchema", () => {
  test("accepts an array of items with valid meta", () => {
    const input = {
      data: [{ id: faker.string.uuid() }, { id: faker.string.uuid() }],
      meta: createMetaInput()
    }

    const result = paginatedSchema(sampleItemSchema).safeParse(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(input)
    }
  })

  test("accepts an empty data array", () => {
    const result = paginatedSchema(sampleItemSchema).safeParse({ data: [], meta: createMetaInput() })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data).toEqual([])
    }
  })

  test("rejects non-array data", () => {
    const result = paginatedSchema(sampleItemSchema).safeParse({
      data: { id: faker.string.uuid() },
      meta: createMetaInput()
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["data"])
    }
  })

  test("rejects items that do not match the item schema", () => {
    const result = paginatedSchema(sampleItemSchema).safeParse({
      data: [{ id: faker.string.uuid() }, { unexpected: "value" }],
      meta: createMetaInput()
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["data.1.id"])
    }
  })

  test("rejects invalid meta", () => {
    const result = paginatedSchema(sampleItemSchema).safeParse({
      data: [{ id: faker.string.uuid() }],
      meta: createMetaInput({ page: 0 })
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["meta.page"])
    }
  })

  test("has descriptions on the root and every field, reusing the meta schema description", () => {
    const schema = paginatedSchema(sampleItemSchema)

    expect(schema.description).toBe("Paginated list response with metadata")

    const shape = schema.shape
    expect(shape.data.description).toBe("Paginated items")
    expect(shape.meta.description).toBe("Pagination metadata")
  })
})
