import { treaty } from "@elysiajs/eden"
import { faker } from "@faker-js/faker"
import slugify from "@sindresorhus/slugify"
import { eq } from "drizzle-orm"

import { database } from "../src/common/database.js"
import { validationErrorSchema } from "../src/common/error.js"
import { app } from "../src/main.js"
import type {
  ArticleCategory,
  UpsertArticleCategoryTranslationBody
} from "../src/modules/article/schemas/article-category.schema.js"
import { articleCategories, articleCategoryTranslations } from "../src/modules/article/tables/article-category.table.js"
import { articles } from "../src/modules/article/tables/article.table.js"
import { createAuthSession } from "./helpers/auth.js"
import type { EdenApiError, EdenValidationError } from "./helpers/validation.js"

const api = treaty(app)

interface CategoryTreatyResult {
  data: ArticleCategory | null
  error: EdenApiError<unknown> | null
  status: number
  headers: Headers
}

interface CategoryOptions {
  headers?: Record<string, string>
}

interface CategoryIdParams {
  id: string
}

interface CategoryIdentifierParams {
  identifier: string
}

interface CategoryLocaleParams {
  // Path segment text: deliberately string so tests can probe locales outside the enum.
  locale: string
}

interface CategoryTranslationNode {
  put(body: UpsertArticleCategoryTranslationBody, options?: CategoryOptions): Promise<CategoryTreatyResult>
}

interface CategoryByIdNode {
  translations(params: CategoryLocaleParams): CategoryTranslationNode
  delete(body?: undefined, options?: CategoryOptions): Promise<CategoryTreatyResult>
}

interface CategoryByIdentifierNode {
  get(options?: CategoryOptions): Promise<CategoryTreatyResult>
}

interface CategoriesSegment {
  (params: CategoryIdParams): CategoryByIdNode
  (params: CategoryIdentifierParams): CategoryByIdentifierNode
}

// SAFETY: eden v1 intersects the params of sibling dynamic routes (:id, :identifier) under one path segment and
// erases the method types of the result; this declaration restores the correct runtime proxy variant so the
// treaty seam stays fully typed at the call sites.
const categoriesSegment: CategoriesSegment = api.api["article-categories"] as never

function categoryById(id: string): CategoryByIdNode {
  return categoriesSegment({ id })
}

function categoryByIdentifier(identifier: string): CategoryByIdentifierNode {
  return categoriesSegment({ identifier })
}

async function createCategory(adminHeaders: Record<string, string>, locale: "en" | "id" = "en") {
  const { data } = await api.api["article-categories"].post(
    {
      locale,
      name: faker.lorem.words({ min: 1, max: 3 }),
      slug: faker.lorem.slug(),
      description: faker.lorem.sentence()
    },
    { headers: adminHeaders }
  )
  if (!data) throw new Error("failed to seed category")
  return data
}

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

describe("GET /api/article-categories/:identifier", () => {
  async function addTranslation(category: { id: string }, adminHeaders: Record<string, string>, locale: "en" | "id") {
    const { data } = await categoryById(category.id)
      .translations({ locale })
      .put(
        {
          name: faker.lorem.words({ min: 1, max: 3 }),
          slug: faker.lorem.slug()
        },
        { headers: adminHeaders }
      )
    if (!data) throw new Error("failed to seed translation")
    return data
  }

  test("returns 200 for a known id without authentication and echoes Content-Language", async () => {
    const category = await createCategory(await createAuthSession("admin"))

    const { data, error, status, headers } = await categoryByIdentifier(category.id).get()

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data).toMatchObject({
      id: category.id,
      locale: "en",
      name: category.name,
      slug: category.slug,
      description: category.description
    })
    expect(headers.get("content-language")).toBe("en")
  })

  test("returns 200 by slug, resolving the identifier case-insensitively", async () => {
    const category = await createCategory(await createAuthSession("admin"))

    const { data, error, status } = await categoryByIdentifier(category.slug.toUpperCase()).get()

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data?.id).toBe(category.id)
    expect(data?.slug).toBe(category.slug)
  })

  test("scopes slug lookup to the resolved locale", async () => {
    const adminHeaders = await createAuthSession("admin")
    const category = await createCategory(adminHeaders)
    const translated = await addTranslation(category, adminHeaders, "id")

    const hit = await categoryByIdentifier(translated.slug).get({
      headers: { "x-locale": "id" }
    })
    expect(hit.error).toBeNull()
    expect(hit.status).toBe(200)
    expect(hit.data?.id).toBe(category.id)
    expect(hit.data?.name).toBe(translated.name)
    expect(hit.headers.get("content-language")).toBe("id")

    const miss = await categoryByIdentifier(category.slug).get({
      headers: { "x-locale": "id" }
    })
    expect(miss.status).toBe(404)
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((miss.error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 404 for a slug that does not exist in the resolved locale", async () => {
    const adminHeaders = await createAuthSession("admin")
    const category = await createCategory(adminHeaders)

    const { error, status } = await categoryByIdentifier(`${category.slug}-missing`).get()

    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 404 with a generic message for an id that does not exist", async () => {
    const { error, status } = await categoryByIdentifier(faker.string.uuid({ version: 7 })).get()

    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 404 with a translation-specific message when the category exists without the locale", async () => {
    const category = await createCategory(await createAuthSession("admin"))

    const { error, status, headers } = await categoryByIdentifier(category.id).get({
      headers: { "x-locale": "id" }
    })

    expect(status).toBe(404)
    expect(error).not.toBeNull()
    expect(headers.get("content-language")).toBe("id")
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value.message).toContain("translation")
  })

  describe("locale resolution", () => {
    test("prefers X-Locale over Accept-Language", async () => {
      const adminHeaders = await createAuthSession("admin")
      const category = await createCategory(adminHeaders)
      await addTranslation(category, adminHeaders, "id")

      const { data, status, headers } = await categoryByIdentifier(category.slug).get({
        headers: { "x-locale": "en", "accept-language": "id,en;q=0.9" }
      })

      expect(status).toBe(200)
      expect(data?.id).toBe(category.id)
      expect(data?.name).toBe(category.name)
      expect(headers.get("content-language")).toBe("en")
    })

    test("falls back to Accept-Language when X-Locale is absent", async () => {
      const adminHeaders = await createAuthSession("admin")
      const category = await createCategory(adminHeaders)
      const translated = await addTranslation(category, adminHeaders, "id")

      const { data, status, headers } = await categoryByIdentifier(translated.slug).get({
        headers: { "accept-language": "id,en;q=0.9" }
      })

      expect(status).toBe(200)
      expect(data?.name).toBe(translated.name)
      expect(headers.get("content-language")).toBe("id")
    })

    test("falls back to the default locale when no locale headers are sent", async () => {
      const category = await createCategory(await createAuthSession("admin"))

      const { data, status, headers } = await categoryByIdentifier(category.slug).get()

      expect(status).toBe(200)
      expect(data?.id).toBe(category.id)
      expect(headers.get("content-language")).toBe("en")
    })
  })

  describe("422 Unprocessable Entity", () => {
    test("rejects an identifier that slugifies to an empty string", async () => {
      const { error, status } = await categoryByIdentifier("---").get()

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      const payload = (error as EdenValidationError).value
      expect(validationErrorSchema.safeParse(payload).success).toBe(true)
      expect(payload).toMatchObject({ type: "validation", on: "params", property: "identifier" })
    })

    test("rejects an identifier exceeding 255 characters", async () => {
      const { error, status } = await categoryByIdentifier("a".repeat(256)).get()

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      const payload = (error as EdenValidationError).value
      expect(validationErrorSchema.safeParse(payload).success).toBe(true)
      expect(payload).toMatchObject({ type: "validation", on: "params", property: "identifier" })
    })
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
    test("rejects a slug that looks like a category id", async () => {
      const headers = await createAuthSession("admin")

      const { error, status } = await api.api["article-categories"].post(
        { locale: "en", name: faker.lorem.words(2), slug: faker.string.uuid({ version: 7 }) },
        { headers }
      )

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug must not look like a category id")
      })
    })
  })
})

describe("PUT /api/article-categories/:id/translations/:locale", () => {
  describe("200/201 Upsert", () => {
    test("creates a translation for a new locale with 201", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)
      const name = faker.lorem.words({ min: 1, max: 3 })
      const slug = faker.lorem.slug()

      const { data, error, status } = await categoryById(category.id)
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

      const { data, error, status } = await categoryById(category.id)
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

      const { data } = await categoryById(category.id)
        .translations({ locale: "en" })
        .put({ name: category.name, slug: category.slug }, { headers })

      expect(data?.description).toBeUndefined()
    })

    test("slugifies the provided slug", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)
      const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()

      const { data, status } = await categoryById(category.id)
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

      const { error, status } = await categoryById(second.id)
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

      const { error, status } = await categoryById("not-an-id")
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

    test("rejects a slug that renames to a category-id-shaped value", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)

      const { error, status } = await categoryById(category.id)
        .translations({ locale: "id" })
        .put({ name: category.name, slug: faker.string.uuid({ version: 7 }) }, { headers })

      expect(status).toBe(422)
      expect(error).not.toBeNull()
      // SAFETY: error is ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "slug",
        message: expect.stringContaining("Slug must not look like a category id")
      })
    })

    test("rejects a locale outside the enum", async () => {
      const headers = await createAuthSession("admin")
      const category = await createCategory(headers)

      const { error, status } = await categoryById(category.id)
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

    const { error, status } = await categoryById(faker.string.uuid({ version: 7 }))
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

      const { error, status } = await categoryById(category.id).translations({ locale: "en" }).put({
        name: category.name,
        slug: category.slug
      })

      expect(status).toBe(401)
      expect(error).not.toBeNull()
    })

    test("rejects non-admin session with 403", async () => {
      const category = await createCategory(await createAuthSession("admin"))
      const userHeaders = await createAuthSession("user")

      const { error, status } = await categoryById(category.id)
        .translations({ locale: "en" })
        .put({ name: category.name, slug: category.slug }, { headers: userHeaders })

      expect(status).toBe(403)
      expect(error).not.toBeNull()
    })
  })
})

describe("DELETE /api/article-categories/:id", () => {
  async function seedArticle(categoryId: string) {
    const [article] = await database.insert(articles).values({ categoryId }).returning()
    if (!article) throw new Error("failed to seed article")
    return article
  }

  test("deletes the category and returns 204 with no body", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)

    const { data, error, status } = await categoryById(category.id).delete(undefined, {
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

    const { status } = await categoryById(target.id).delete(undefined, { headers })
    expect(status).toBe(204)

    const list = await api.api["article-categories"].get({ query: { page: 1, limit: 100 } })
    const ids = list.data?.data.map(row => row.id) ?? []
    expect(ids).not.toContain(target.id)
    expect(ids).toContain(other.id)
  })

  test("cascades deletion to all CategoryTranslations", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)
    await categoryById(category.id)
      .translations({ locale: "id" })
      .put({ name: faker.lorem.words(2), slug: faker.lorem.slug() }, { headers })

    const { status } = await categoryById(category.id).delete(undefined, { headers })
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

    const { status } = await categoryById(category.id).delete(undefined, { headers })
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

    const { error, status } = await categoryById(faker.string.uuid({ version: 7 })).delete(undefined, { headers })

    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 404 when the same Category is deleted twice", async () => {
    const headers = await createAuthSession("admin")
    const category = await createCategory(headers)

    const first = await categoryById(category.id).delete(undefined, { headers })
    expect(first.status).toBe(204)

    const { error, status } = await categoryById(category.id).delete(undefined, { headers })
    expect(status).toBe(404)
    expect(error).not.toBeNull()
    // SAFETY: error is EdenApiError with parsed body per previous expect
    expect((error as EdenApiError<{ message: string }>).value).toEqual({ message: "Article category not found" })
  })

  test("returns 422 when the id is not a valid UUIDv7", async () => {
    const headers = await createAuthSession("admin")

    const { error, status } = await categoryById("not-an-id").delete(undefined, { headers })

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

    const { error, status } = await categoryById(category.id).delete()

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("returns 403 for a non-admin session", async () => {
    const category = await createCategory(await createAuthSession("admin"))
    const userHeaders = await createAuthSession("user")

    const { error, status } = await categoryById(category.id).delete(undefined, {
      headers: userHeaders
    })

    expect(status).toBe(403)
    expect(error).not.toBeNull()
  })
})
