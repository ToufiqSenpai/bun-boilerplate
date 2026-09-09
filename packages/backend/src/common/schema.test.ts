import { richTextContentSchema } from "@bun-boilerplate/richtext"
import { faker } from "@faker-js/faker"
import { z } from "zod"

import { collectionSchema, isFilePart, jsonStringSchema, omitCollection, timestampSchema } from "./schema.js"

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
    const result = collectionSchema.safeParse(createCollectionInput({ createdAt: "yesterday", updatedAt: "tomorrow" }))

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

describe("omitCollection", () => {
  const itemSchema = z.object({ name: z.string(), ...collectionSchema.shape })
  const withoutCollection = omitCollection(itemSchema)

  test("removes exactly the collection fields from the shape", () => {
    expect(Object.keys(withoutCollection.shape).sort()).toEqual(["name"])
  })

  test("parses payloads that carry no collection fields", () => {
    const result = withoutCollection.safeParse({ name: "Technology" })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: "Technology" })
    }
  })

  test("strips collection keys when they are present in the input", () => {
    const result = withoutCollection.safeParse({ ...createCollectionInput(), name: "Technology" })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(["name"])
    }
  })

  test("keeps validating the remaining fields", () => {
    const result = withoutCollection.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(issuePaths(result.error)).toEqual(["name"])
    }
  })
})

describe("jsonStringSchema", () => {
  test("parses a JSON string into a value", () => {
    expect(jsonStringSchema.safeParse('{"type":"doc"}')).toEqual({ success: true, data: { type: "doc" } })
  })

  test("passes an already-parsed object through", () => {
    expect(jsonStringSchema.safeParse({ type: "doc" })).toEqual({ success: true, data: { type: "doc" } })
  })

  test("rejects a string that is not JSON", () => {
    expect(jsonStringSchema.safeParse("not json {").success).toBe(false)
  })
})

describe("richTextContentSchema", () => {
  test("accepts a valid rich text document and returns it unchanged", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] }

    const result = richTextContentSchema.safeParse(doc)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(doc)
    }
  })

  test("rejects JSON scalars and arrays that are not documents", () => {
    expect(richTextContentSchema.safeParse("hello").success).toBe(false)
    expect(richTextContentSchema.safeParse([]).success).toBe(false)
  })

  test("rejects a document with an empty root with the ProseMirror content-spec message", () => {
    const result = richTextContentSchema.safeParse({ type: "doc", content: [] })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Invalid content for node doc/)
    }
  })

  test("rejects unknown node types with the ProseMirror node-type message", () => {
    const result = richTextContentSchema.safeParse({ type: "doc", content: [{ type: "ghost-paragraph" }] })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/node type/i)
    }
  })

  test("has a description", () => {
    expect(richTextContentSchema.description).toBe("Rich text document validated against the shared tiptap schema")
  })
})

describe("isFilePart", () => {
  const part = {
    file: new File(["binary"], "part.png", { type: "image/png" }),
    mime: "image/png",
    extension: "png"
  }

  test("accepts a complete file part", () => {
    expect(isFilePart(part)).toBe(true)
  })

  test("rejects non-objects", () => {
    expect(isFilePart(null)).toBe(false)
    expect(isFilePart(undefined)).toBe(false)
    expect(isFilePart("part")).toBe(false)
    expect(isFilePart(42)).toBe(false)
  })

  test("rejects objects without a File", () => {
    expect(isFilePart({})).toBe(false)
    expect(isFilePart({ file: "not-a-file", mime: "image/png", extension: "png" })).toBe(false)
  })

  test("rejects a raw File, which carries no part envelope", () => {
    expect(isFilePart(new File(["binary"], "part.png", { type: "image/png" }))).toBe(false)
  })

  test("rejects parts with a missing or empty mime or extension", () => {
    expect(isFilePart({ ...part, mime: 42 })).toBe(false)
    expect(isFilePart({ ...part, extension: "" })).toBe(false)
    const { mime: _mime, ...withoutMime } = part
    expect(isFilePart(withoutMime)).toBe(false)
  })
})
