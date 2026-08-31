import { faker } from "@faker-js/faker"
import slugify from "@sindresorhus/slugify"
import type { z } from "zod"

import { database } from "../../../common/database.js"
import { articleCategories, articleCategoryTranslations } from "../tables/article-category.table.js"
import { createArticleCategorySchema } from "./article-category.schema.js"

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

async function parseData(input: Input) {
  const result = await createArticleCategorySchema.safeParseAsync(input)
  if (result.success) return result.data
  throw new Error(`expected success, got: ${result.error.issues.map(issue => issue.message).join("; ")}`)
}

async function parseIssues(input: Input) {
  const result = await createArticleCategorySchema.safeParseAsync(input)
  if (result.success) {
    expect.unreachable("expected validation to fail")
  }
  return result.error.issues
}

async function seedExistingSlug(slug: string, locale: "en" | "id") {
  const [category] = await database.insert(articleCategories).values({}).returning()
  if (!category) throw new Error("failed to seed article category")
  await database
    .insert(articleCategoryTranslations)
    .values({ categoryId: category.id, name: faker.lorem.words({ min: 1, max: 3 }), slug, locale })
}

describe("createArticleCategorySchema", () => {
  describe("slug", () => {
    test("slugifies the provided slug", async () => {
      const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()
      const data = await parseData(createInput({ slug: rawSlug }))

      expect(data.slug).toBe(slugify(rawSlug))
    })

    test("rejects an empty slug", async () => {
      const issues = await parseIssues(createInput({ slug: "" }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must not be empty"
        })
      ])
    })

    test("rejects a slug that slugifies to an empty string", async () => {
      const issues = await parseIssues(createInput({ slug: "---" }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must not be empty"
        })
      ])
    })

    test("rejects a slug exceeding the max length", async () => {
      const issues = await parseIssues(createInput({ slug: "a".repeat(256) }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must be at most 255 characters"
        })
      ])
    })

    test("rejects a non-string slug", async () => {
      const issues = await parseIssues(createInput({ slug: faker.number.int() }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must be a string"
        })
      ])
    })

    test("rejects a missing slug", async () => {
      const { slug: _ignored, ...withoutSlug } = createInput()
      const issues = await parseIssues(withoutSlug)

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug must be a string"
        })
      ])
    })

    test("rejects a slug already stored for the same locale", async () => {
      const existingSlug = faker.lorem.slug()
      await seedExistingSlug(existingSlug, "en")

      const issues = await parseIssues(createInput({ locale: "en", slug: existingSlug }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug already exists"
        })
      ])
    })

    test("accepts the same slug under a different locale", async () => {
      const existingSlug = faker.lorem.slug()
      await seedExistingSlug(existingSlug, "en")

      const data = await parseData(createInput({ locale: "id", slug: existingSlug }))

      expect(data.slug).toBe(existingSlug)
      expect(data.locale).toBe("id")
    })

    test("treats slug comparison as case-insensitive thanks to slugification", async () => {
      const existingSlug = `${faker.lorem.word()}-${faker.lorem.word()}`
      await seedExistingSlug(existingSlug, "en")

      const issues = await parseIssues(createInput({ locale: "en", slug: existingSlug.toUpperCase() }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["slug"],
          message: "Slug already exists"
        })
      ])
    })

    test("accepts a slug that differs from stored slugs", async () => {
      await seedExistingSlug(faker.lorem.slug(), "en")

      const data = await parseData(createInput())

      expect(data.slug).toBeTypeOf("string")
    })
  })

  describe("name", () => {
    test("rejects an empty name", async () => {
      const issues = await parseIssues(createInput({ name: "" }))

      expect(issues).toEqual([
        expect.objectContaining({
          path: ["name"],
          message: "Name must not be empty"
        })
      ])
    })
  })
})
