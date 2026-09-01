import { faker } from "@faker-js/faker"
import { z } from "zod"

import { collectionSchema, timestampSchema } from "./schema.js"

function createTimestamp() {
  return faker.date.recent().toISOString()
}

interface CollectionInput {
  id: string
  createdAt: string | Date
  updatedAt: string | Date
}

function createCollectionInput(overrides: Partial<CollectionInput> = {}): CollectionInput {
  return {
    id: faker.string.uuid({ version: 7 }),
    createdAt: createTimestamp(),
    updatedAt: createTimestamp(),
    ...overrides
  }
}

function issuePaths(error: z.ZodError) {
  return error.issues.map(issue => issue.path.join("."))
}

describe("timestampSchema", () => {
  describe("decode", () => {
    test("accepts an ISO 8601 datetime string and returns a Date", () => {
      const iso = createTimestamp()

      const result = timestampSchema.safeParse(iso)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeInstanceOf(Date)
        expect(result.data.toISOString()).toBe(iso)
      }
    })

    test("accepts a Date instance and returns a Date with the same value", () => {
      const date = faker.date.recent()

      const result = timestampSchema.safeParse(date)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeInstanceOf(Date)
        expect(result.data.getTime()).toBe(date.getTime())
      }
    })

    test("rejects a non-ISO datetime string", () => {
      const result = timestampSchema.safeParse("not-a-date")

      expect(result.success).toBe(false)
    })

    test("rejects a date-only string without time component", () => {
      const result = timestampSchema.safeParse("2026-01-01")

      expect(result.success).toBe(false)
    })

    test("rejects a number timestamp", () => {
      const result = timestampSchema.safeParse(Date.now())

      expect(result.success).toBe(false)
    })

    test("rejects an invalid Date", () => {
      const result = timestampSchema.safeParse(new Date(Number.NaN))

      expect(result.success).toBe(false)
    })
  })

  describe("encode", () => {
    test("encodes a Date to an ISO 8601 string", () => {
      const date = faker.date.recent()

      expect(timestampSchema.encode(date)).toBe(date.toISOString())
    })
  })

  test("has a description", () => {
    expect(timestampSchema.description).toBe("ISO 8601 datetime string or Date instance")
  })
})

describe("collectionSchema", () => {
  test("parses a valid collection item and decodes timestamps to Dates", () => {
    const createdAt = createTimestamp()
    const updatedAt = createTimestamp()

    const result = collectionSchema.safeParse(createCollectionInput({ createdAt, updatedAt }))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBeTypeOf("string")
      expect(result.data.createdAt).toBeInstanceOf(Date)
      expect(result.data.updatedAt).toBeInstanceOf(Date)
      expect(result.data.createdAt.toISOString()).toBe(createdAt)
      expect(result.data.updatedAt.toISOString()).toBe(updatedAt)
    }
  })

  test("accepts Date instances for timestamps", () => {
    const result = collectionSchema.safeParse(
      createCollectionInput({ createdAt: faker.date.recent(), updatedAt: faker.date.recent() })
    )

    expect(result.success).toBe(true)
  })

  test("rejects a missing required field", () => {
    const { updatedAt: _ignored, ...withoutUpdatedAt } = createCollectionInput()

    const result = collectionSchema.safeParse(withoutUpdatedAt)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["updatedAt"])
    }
  })

  test("rejects an id that is not a UUID v7", () => {
    const result = collectionSchema.safeParse(createCollectionInput({ id: faker.string.uuid({ version: 4 }) }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["id"])
    }
  })

  test("rejects invalid timestamps on createdAt and updatedAt", () => {
    const result = collectionSchema.safeParse(
      createCollectionInput({ createdAt: "yesterday", updatedAt: "tomorrow" })
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error).sort()).toEqual(["createdAt", "updatedAt"])
    }
  })

  test("rejects unknown keys structurally while still parsing known keys", () => {
    const result = collectionSchema.safeParse({ ...createCollectionInput(), extra: "value" })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(["createdAt", "id", "updatedAt"])
    }
  })

  test("has descriptions on the root and every field", () => {
    expect(collectionSchema.description).toBe("Base collection item with identifiers and timestamps")

    const shape = collectionSchema.shape
    expect(shape.id.description).toBe("Unique identifier")
    expect(shape.createdAt.description).toBe("Creation timestamp")
    expect(shape.updatedAt.description).toBe("Last update timestamp")
  })
})
