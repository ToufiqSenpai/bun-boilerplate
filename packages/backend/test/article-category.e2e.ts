import { treaty } from "@elysiajs/eden"
import { faker } from "@faker-js/faker"
import slugify from "@sindresorhus/slugify"
import { eq } from "drizzle-orm"

import { database } from "../src/common/database.js"
import { validationErrorSchema } from "../src/common/error.js"
import { app } from "../src/main.js"
import { articleCategories, articleCategoryTranslations } from "../src/modules/article/tables/article-category.table.js"
import { articles } from "../src/modules/article/tables/article.table.js"
import { createAuthSession } from "./helpers/auth.js"
import type { EdenApiError, EdenValidationError } from "./helpers/validation.js"

const api = treaty(app)

describe("GET /api/article-categories", () => {
  test("returns 200 with empty paginated data on fresh database", async () => {
    const { data, error, status } = await api.api["article-categories"].get({
      query: { page: faker.number.int({ min: 1, max: 3 }), limit: 20 }
    })

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data?.data).toEqual([])
    expect(data?.meta.total).toBe(0)
  })
})

describe("POST /api/article-categories", () => {
  describe("201 Created", () => {
    test("creates with all fields", async () => {
      const headers = await createAuthSession("admin")
      const name = faker.lorem.words({ min: 1, max: 3 })
      const locale = faker.helpers.arrayElement(["en", "id"] as const)
      const description = faker.lorem.sentence()
      const slug = faker.lorem.slug()

      const { data, error, status } = await api.api["article-categories"].post(
        { locale, name, slug, description },
        { headers }
      )

      expect(error).toBeNull()
      expect(status).toBe(201)
      expect(data?.name).toBe(name)
      expect(data?.locale).toBe(locale)
      expect(data?.slug).toBe(slugify(slug))
      expect(data?.id).toBeDefined()
    })

    test("rejects missing slug with 422", async () => {
      const headers = await createAuthSession("admin")

      // SAFETY: omitting slug to trigger required-field validation
      const { error, status } = await api.api["article-categories"].post(
        { locale: "en", name: faker.lorem.words({ min: 1, max: 3 }) } as never,
        { headers }
      )

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      const payload = (error as EdenValidationError).value

      expect(validationErrorSchema.safeParse(payload).success).toBe(true)
      expect(payload).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug"),
        found: expect.any(Object),
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["slug"],
            message: expect.stringContaining("Slug")
          })
        ])
      })
    })

    test("slugifies explicit slug", async () => {
      const headers = await createAuthSession("admin")
      const name = faker.lorem.words({ min: 1, max: 3 })
      const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()

      const { data, error, status } = await api.api["article-categories"].post(
        { locale: "en", name, slug: rawSlug },
        { headers }
      )

      expect(error).toBeNull()
      expect(status).toBe(201)
      expect(data?.slug).toBe(slugify(rawSlug))
    })
  })

  describe("401 Unauthorized", () => {
    test("without session", async () => {
      const { error, status } = await api.api["article-categories"].post({
        locale: faker.helpers.arrayElement(["en", "id"] as const),
        name: faker.lorem.words({ min: 1, max: 3 }),
        slug: faker.lorem.slug(),
        description: faker.lorem.sentence()
      })

      expect(status).toBe(401)
      expect(error).not.toBeNull()
    })
  })

  describe("403 Forbidden", () => {
    test("for non-admin session", async () => {
      const headers = await createAuthSession("user")

      const { error, status } = await api.api["article-categories"].post(
        {
          locale: "en",
          name: faker.lorem.words({ min: 1, max: 3 }),
          slug: faker.lorem.slug()
        },
        { headers }
      )

      expect(status).toBe(403)
      expect(error).not.toBeNull()
    })
  })

  describe("422 Unprocessable Entity", () => {
    test("empty name", async () => {
      const headers = await createAuthSession("admin")

      // SAFETY: sending empty name to trigger Zod validation (required field)
      const { error, status } = await api.api["article-categories"].post(
        // SAFETY: intentionally invalid payload for validation test
        { locale: "en", name: "" } as never,
        { headers }
      )

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "name",
        message: expect.stringContaining("Name must not be empty"),
        found: expect.objectContaining({ name: "" }),
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["name"],
            message: expect.stringContaining("Name must not be empty")
          })
        ])
      })
    })

    test("empty slug", async () => {
      const headers = await createAuthSession("admin")

      const { error, status } = await api.api["article-categories"].post(
        { locale: "en", name: faker.lorem.words(2), slug: "" },
        { headers }
      )

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug must not be empty"),
        found: expect.any(Object),
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["slug"],
            message: expect.stringContaining("Slug must not be empty")
          })
        ])
      })
    })

    test("slug that slugifies to an empty string", async () => {
      const headers = await createAuthSession("admin")

      const { error, status } = await api.api["article-categories"].post(
        { locale: "en", name: faker.lorem.words(2), slug: "---" },
        { headers }
      )

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug must not be empty"),
        found: expect.any(Object),
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["slug"],
            message: expect.stringContaining("Slug must not be empty")
          })
        ])
      })
    })

    test("duplicate slug", async () => {
      const headers = await createAuthSession("admin")
      const slug = faker.lorem.slug()
      const name1 = faker.lorem.words({ min: 1, max: 3 })
      const name2 = faker.lorem.words({ min: 1, max: 3 })

      const { status: s1 } = await api.api["article-categories"].post({ locale: "en", name: name1, slug }, { headers })
      expect(s1).toBe(201)

      const { error, status } = await api.api["article-categories"].post(
        { locale: "en", name: name2, slug },
        { headers }
      )

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug already exists"),
        found: expect.any(Object),
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["slug"],
            message: expect.stringContaining("Slug already exists")
          })
        ])
      })
    })
  })
})

describe("PUT /api/article-categories/:id/translations/:locale", () => {
  async function createCategory(adminHeaders: Record<string, string>) {
    const { data } = await api.api["article-categories"].post(
      {
        locale: "en",
        name: faker.lorem.words({ min: 1, max: 3 }),
        slug: faker.lorem.slug(),
        description: faker.lorem.sentence()
      },
      { headers: adminHeaders }
    )
    if (!data) throw new Error("failed to seed category")
    return data
  }

  describe("200/201 Upsert", () => {
    test("creates a translation for a new locale with 201", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)
      const name = faker.lorem.words({ min: 1, max: 3 })
      const slug = faker.lorem.slug()

      const { data, error, status } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "id" })
        .put({ name, slug }, { headers })

      expect(error).toBeNull()
      expect(status).toBe(201)
      expect(data?.name).toBe(name)
      expect(data?.slug).toBe(slug)
      expect(data?.id).toBe(category.id)
    })

    test("replaces an existing translation with 200", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)
      const newName = faker.lorem.words({ min: 1, max: 3 })

      const { data, error, status } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "en" })
        .put({ name: newName, slug: category.slug }, { headers })

      expect(error).toBeNull()
      expect(status).toBe(200)
      expect(data?.name).toBe(newName)
      expect(data?.slug).toBe(category.slug)
    })

    test("clears description when omitted", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)
      expect(category.description).toBeDefined()

      const { data } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "en" })
        .put({ name: category.name, slug: category.slug }, { headers })

      expect(data?.description).toBeUndefined()
    })

    test("slugifies the provided slug", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)
      const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()

      const { data, status } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "id" })
        .put({ name: category.name, slug: rawSlug }, { headers })

      expect(status).toBe(201)
      expect(data?.slug).toBe(slugify(rawSlug))
    })
  })

  describe("422 Unprocessable Entity", () => {
    test("rejects a slug owned by a different category for the same locale", async () => {
      const headers = await createAuthSession("admin")
      const first = await createCategory(headers)
      const second = await createCategory(headers)

      const { error, status } = await api.api["article-categories"]({ id: second.id })
        .translations({ locale: "en" })
        .put({ name: second.name, slug: first.slug }, { headers })

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug already exists"),
        found: expect.any(Object),
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["slug"],
            message: expect.stringContaining("Slug already exists")
          })
        ])
      })
    })

    test("rejects a non-uuid category id", async () => {
      const headers = await createAuthSession("admin")

      const { error, status } = await api.api["article-categories"]({ id: "not-an-id" })
        .translations({ locale: "en" })
        .put({ name: faker.lorem.words({ min: 1, max: 3 }), slug: faker.lorem.slug() }, { headers })

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "params",
        property: "id",
        message: expect.stringContaining("Invalid category id")
      })
    })

    test("rejects a locale outside the enum", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)

      const { error, status } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "de" })
        .put({ name: category.name, slug: faker.lorem.slug() }, { headers })

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "params",
        property: "locale",
        message: expect.stringContaining("Invalid locale")
      })
    })
  })

  test("returns 404 when the category does not exist", async () => {
    const headers = await createAuthSession("admin")

    const { error, status } = await api.api["article-categories"]({ id: faker.string.uuid({ version: 7 }) })
      .translations({ locale: "en" })
      .put({ name: faker.lorem.words({ min: 1, max: 3 }), slug: faker.lorem.slug() }, { headers })

    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  describe("authentication", () => {
    test("rejects without session with 401", async () => {
      const category = await createCategory(await createAuthSession("admin"))

      const { error, status } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "en" })
        .put({
          name: category.name,
          slug: category.slug
        })

      expect(status).toBe(401)
      expect(error).not.toBeNull()
    })

    test("rejects non-admin session with 403", async () => {
      const category = await createCategory(await createAuthSession("admin"))
      const userHeaders = await createAuthSession("user")

      const { error, status } = await api.api["article-categories"]({ id: category.id })
        .translations({ locale: "en" })
        .put({ name: category.name, slug: category.slug }, { headers: userHeaders })

      expect(status).toBe(403)
      expect(error).not.toBeNull()
    })
  })
})

describe("DELETE /api/article-categories/:id", () => {
  async function createCategory(adminHeaders: Record<string, string>) {
    const { data } = await api.api["article-categories"].post(
      {
        locale: "en",
        name: faker.lorem.words({ min: 1, max: 3 }),
        slug: faker.lorem.slug(),
        description: faker.lorem.sentence()
      },
      { headers: adminHeaders }
    )
    if (!data) throw new Error("failed to seed category")
    return data
  }

  async function seedArticle(categoryId: string) {
    const [article] = await database.insert(articles).values({ categoryId }).returning()
    if (!article) throw new Error("failed to seed article")
    return article
  }

  test("deletes the category and returns 204 with no body", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)

    const { data, error, status } = await api.api["article-categories"]({ id: category.id }).delete(undefined, {
      headers
    })

    expect(status).toBe(204)
    expect(error).toBeNull()
    // 204 has no content-type, so treaty decodes the empty body as an empty string
    expect(data).toBe("")

    const [removed] = await database
      .select({ id: articleCategories.id })
      .from(articleCategories)
      .where(eq(articleCategories.id, category.id))
      .limit(1)
    expect(removed).toBeUndefined()

    const list = await api.api["article-categories"].get({ query: { page: 1, limit: 100 } })
    expect(list.data?.data.some(row => row.id === category.id)).toBe(false)
  })

  test("deletes only the targeted Category, leaving others intact", async () => {
    const headers = await createAuthSession("admin")
    const target = await createCategory(headers)
    const other = await createCategory(headers)

    const { status } = await api.api["article-categories"]({ id: target.id }).delete(undefined, { headers })
    expect(status).toBe(204)

    const list = await api.api["article-categories"].get({ query: { page: 1, limit: 100 } })
    const ids = list.data?.data.map(row => row.id) ?? []
    expect(ids).not.toContain(target.id)
    expect(ids).toContain(other.id)
  })

  test("cascades deletion to all CategoryTranslations", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)
    await api.api["article-categories"]({ id: category.id })
      .translations({ locale: "id" })
      .put({ name: faker.lorem.words(2), slug: faker.lorem.slug() }, { headers })

    const { status } = await api.api["article-categories"]({ id: category.id }).delete(undefined, { headers })
    expect(status).toBe(204)

    const translations = await database
      .select({ id: articleCategoryTranslations.id })
      .from(articleCategoryTranslations)
      .where(eq(articleCategoryTranslations.categoryId, category.id))
    expect(translations).toEqual([])
  })

  test("clears the Category reference on linked Articles via SET NULL", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)
    const article = await seedArticle(category.id)

    const { status } = await api.api["article-categories"]({ id: category.id }).delete(undefined, { headers })
    expect(status).toBe(204)

    const [remaining] = await database
      .select({ categoryId: articles.categoryId })
      .from(articles)
      .where(eq(articles.id, article.id))
      .limit(1)
    expect(remaining?.categoryId).toBeNull()
  })

  test("returns 404 when the Category does not exist", async () => {
    const headers = await createAuthSession("admin")

    const { error, status } = await api.api["article-categories"]({
      id: faker.string.uuid({ version: 7 })
    }).delete(undefined, { headers })

    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 404 when the same Category is deleted twice", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)

    const first = await api.api["article-categories"]({ id: category.id }).delete(undefined, { headers })
    expect(first.status).toBe(204)

    const { error, status } = await api.api["article-categories"]({ id: category.id }).delete(undefined, { headers })
    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 422 when the id is not a valid UUIDv7", async () => {
    const headers = await createAuthSession("admin")

    const { error, status } = await api.api["article-categories"]({ id: "not-an-id" }).delete(undefined, { headers })

    expect(status).toBe(422)
    expect(error).not.toBeNull()
    // SAFETY: error is ValidationError per previous expect
    expect((error as EdenValidationError).value).toMatchObject({
      type: "validation",
      on: "params",
      property: "id",
      message: expect.stringContaining("Invalid category id")
    })
  })

  test("returns 401 without a session", async () => {
    const category = await createCategory(await createAuthSession("admin"))

    const { error, status } = await api.api["article-categories"]({ id: category.id }).delete()

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("returns 403 for a non-admin session", async () => {
    const category = await createCategory(await createAuthSession("admin"))
    const userHeaders = await createAuthSession("user")

    const { error, status } = await api.api["article-categories"]({ id: category.id }).delete(undefined, {
      headers: userHeaders
    })

    expect(status).toBe(403)
    expect(error).not.toBeNull()
  })
})
