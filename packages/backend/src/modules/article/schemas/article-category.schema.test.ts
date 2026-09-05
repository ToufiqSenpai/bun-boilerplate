import { faker } from "@faker-js/faker"
import slugify from "@sindresorhus/slugify"
import type { z } from "zod"

import { createArticleCategorySchema, getArticleCategoryParamsSchema } from "./article-category.schema.js"

type SchemaInput = z.input<typeof createArticleCategorySchema>
type Input = Omit<SchemaInput, "slug"> & { slug?: string | number }

function createInput(overrides: Partial<Input> = {}): Input {
  return {
    locale: faker.helpers.arrayElement(["en", "id"] as const),
    name: faker.lorem.words({ min: 1, max: 3 }),
    slug: faker.lorem.slug(),
    ...overrides
  }
}

function parseData(input: Input) {
  const result = createArticleCategorySchema.safeParse(input)
  if (result.success) return result.data
  throw new Error(`expected success, got: ${result.error.issues.map(issue => issue.message).join("; ")}`)
}

function parseIssues(input: Input) {
  const result = createArticleCategorySchema.safeParse(input)
  if (result.success) {
    expect.unreachable("expected validation to fail")
  }
  return result.error.issues
}

describe("createArticleCategorySchema", () => {
  describe("slug", () => {
    test("slugifies the provided slug", async () => {
      const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()
      const data = parseData(createInput({ slug: rawSlug }))

      expect(data.slug).toBe(slugify(rawSlug))
    })

    test("rejects an empty slug", async () => {
      const issues = parseIssues(createInput({ slug: "" }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must not be empty"
        })
      ])
    })

    test("rejects a slug that slugifies to an empty string", async () => {
      const issues = parseIssues(createInput({ slug: "---" }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must not be empty"
        })
      ])
    })

    test("rejects a slug exceeding the max length", async () => {
      const issues = parseIssues(createInput({ slug: "a".repeat(256) }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must be at most 255 characters"
        })
      ])
    })

    test("rejects a non-string slug", async () => {
      const issues = parseIssues(createInput({ slug: faker.number.int() }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must be a string"
        })
      ])
    })

    test("rejects a missing slug", async () => {
      const { slug: _ignored, ...withoutSlug } = createInput()
      const issues = parseIssues(withoutSlug)

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must be a string"
        })
      ])
    })

    test("rejects a slug that looks like a category id", async () => {
      const issues = parseIssues(createInput({ slug: faker.string.uuid({ version: 7 }) }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must not look like a category id"
        })
      ])
    })
  })

  describe("name", () => {
    test("rejects an empty name", async () => {
      const issues = parseIssues(createInput({ name: "" }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["name"],
          message: "Name must not be empty"
        })
      ])
    })
  })
})

describe("getArticleCategoryParamsSchema", () => {
  function parseIssuesFor(identifier: string) {
    const result = getArticleCategoryParamsSchema.safeParse({ identifier })
    if (result.success) {
      expect.unreachable("expected validation to fail")
    }
    return result.error.issues
  }

  test("accepts a uuidv7 identifier unchanged", () => {
    const id = faker.string.uuid({ version: 7 })

    const output = getArticleCategoryParamsSchema.parse({ identifier: id })

    expect(output.identifier).toBe(id)
  })

  test("slugifies a slug identifier, resolving case-insensitively", () => {
    const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()

    const output = getArticleCategoryParamsSchema.parse({ identifier: rawSlug })

    expect(output.identifier).toBe(slugify(rawSlug))
  })

  test("accepts a slug identifier at the maximum length", () => {
    const slug = "a".repeat(255)

    const output = getArticleCategoryParamsSchema.parse({ identifier: slug })

    expect(output.identifier).toBe(slug)
  })

  test("treats a uuid-shaped identifier that is not a uuidv7 as a Slug", () => {
    const v4 = faker.string.uuid({ version: 4 })

    const output = getArticleCategoryParamsSchema.parse({ identifier: v4 })

    expect(output.identifier).toBe(slugify(v4))
  })

  test("rejects an empty identifier", () => {
    const issues = parseIssuesFor("")

    expect(issues[0]).toEqual(expect.objectContaining({ path: ["identifier"] }))
  })

  test("rejects an identifier that slugifies to an empty string", () => {
    const issues = parseIssuesFor("---")

    expect(issues[0]).toEqual(expect.objectContaining({ path: ["identifier"] }))
  })

  test("rejects an identifier exceeding the maximum length", () => {
    const issues = parseIssuesFor("a".repeat(256))

    expect(issues[0]).toEqual(expect.objectContaining({ path: ["identifier"] }))
  })
})
