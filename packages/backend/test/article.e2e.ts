import type { RichText } from "@bun-boilerplate/richtext"
import { treaty } from "@elysiajs/eden"
import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"
import type { z } from "zod"

import { database } from "../src/common/database.js"
import { app } from "../src/main.js"
import type { createArticleSchema } from "../src/modules/article/schemas/article.schema.js"
import { articles, articleTranslations } from "../src/modules/article/tables/article.table.js"
import type { ArticleStatus } from "../src/modules/article/tables/article.table.js"
import { createAuthSession } from "./helpers/auth.js"
import type { EdenValidationError } from "./helpers/validation.js"

const api = treaty(app)

interface SeedArticleOptions {
  status?: ArticleStatus
  locale?: "en" | "id"
  coverKey?: string
  content?: RichText
}

const VALID_DOC: RichText = { type: "doc", content: [{ type: "paragraph" }] }

async function seedArticle(options: SeedArticleOptions = {}) {
  const status = options.status ?? "published"
  const locale = options.locale ?? "en"
  const slug = `${faker.lorem.slug()}-${faker.string.uuid({ version: 7 }).slice(0, 8)}`

  const [article] = await database
    .insert(articles)
    // SAFETY: coverKey column is NOT NULL DEFAULT ''; tests insert the empty sentinel explicitly for uniform shape
    .values({ status, coverKey: options.coverKey ?? "" })
    .returning()
  if (!article) throw new Error("failed to seed article")

  const [translation] = await database
    .insert(articleTranslations)
    .values({
      articleId: article.id,
      locale,
      title: faker.lorem.words({ min: 2, max: 5 }),
      slug,
      excerpt: faker.lorem.sentence(),
      content: options.content ?? VALID_DOC,
      metaTitle: faker.lorem.words({ min: 1, max: 3 }),
      metaDescription: faker.lorem.sentence()
    })
    .returning()
  if (!translation) throw new Error("failed to seed article translation")

  return { article, translation }
}

function list(query: { page?: number; limit?: number; status?: ArticleStatus } = {}) {
  // SAFETY: the treaty query type for defaulted fields is the parsed output shape; the server accepts any subset
  return api.api.articles.get({ query: { page: 1, limit: 100, ...query } as never })
}

function listAs(headers: Record<string, string>, status: ArticleStatus) {
  return api.api.articles.get({ query: { page: 1, limit: 100, status }, headers })
}

describe("GET /api/articles", () => {
  test("returns 200 with an empty page on a fresh database", async () => {
    const { data, error, status } = await list({ page: faker.number.int({ min: 2, max: 5 }), limit: 20 })

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data?.data).toEqual([])
    expect(data?.meta.total).toBe(0)
    expect(data?.meta.totalPages).toBe(0)
  })

  test("defaults the status filter to published", async () => {
    const published = await seedArticle({ status: "published" })
    const draft = await seedArticle({ status: "draft" })
    const archived = await seedArticle({ status: "archived" })

    const { data, error, status } = await list()

    expect(error).toBeNull()
    expect(status).toBe(200)
    const ids = data?.data.map(row => row.id) ?? []
    expect(ids).toContain(published.article.id)
    expect(ids).not.toContain(draft.article.id)
    expect(ids).not.toContain(archived.article.id)
  })

  test("filters by the requested status for privileged viewers", async () => {
    const admin = await createAuthSession("admin")
    const superadmin = await createAuthSession("superadmin")
    const published = await seedArticle({ status: "published" })
    const draft = await seedArticle({ status: "draft" })

    const { data, error, status } = await listAs(admin, "draft")

    expect(error).toBeNull()
    expect(status).toBe(200)
    const ids = data?.data.map(row => row.id) ?? []
    expect(ids).toContain(draft.article.id)
    expect(ids).not.toContain(published.article.id)

    const bySuperadmin = await listAs(superadmin, "draft")
    expect(bySuperadmin.data?.data.map(row => row.id)).toContain(draft.article.id)
  })

  test("forces the published status for anonymous and plain-user callers", async () => {
    const plain = await createAuthSession("")
    const draft = await seedArticle({ status: "draft" })

    const anonymous = await list({ status: "draft" })
    expect(anonymous.data?.data.map(row => row.id)).not.toContain(draft.article.id)

    const asPlainUser = await listAs(plain, "archived")
    expect(asPlainUser.error).toBeNull()
    expect(asPlainUser.data?.data.map(row => row.id)).not.toContain(draft.article.id)
  })

  test("returns the requested locale and echoes Content-Language", async () => {
    const english = await seedArticle({ locale: "en" })
    const [second] = await database
      .insert(articleTranslations)
      .values({
        articleId: english.article.id,
        locale: "id",
        title: faker.lorem.words(3),
        slug: `id-${faker.string.uuid({ version: 7 }).slice(0, 8)}`,
        excerpt: faker.lorem.sentence(),
        content: VALID_DOC,
        metaTitle: faker.lorem.words(2),
        metaDescription: faker.lorem.sentence()
      })
      .returning()
    if (!second) throw new Error("failed to seed second translation")

    const result = await list({ status: "published" })
    const headers = new Headers(result.headers)
    const row = result.data?.data.find(item => item.id === english.article.id)

    expect(headers.get("content-language")).toBe("en")
    expect(row?.locale).toBe("en")
    expect(row?.title).toBe(english.translation.title)

    const localized = await api.api.articles.get({
      // SAFETY: omitted keys fall back to the server defaults; only the locale header matters here
      query: { page: 1, limit: 100 } as never,
      headers: { "x-locale": "id" }
    })
    const localizedRow = localized.data?.data.find(item => item.id === english.article.id)

    expect(new Headers(localized.headers).get("content-language")).toBe("id")
    expect(localizedRow?.locale).toBe("id")
    expect(localizedRow?.title).toBe(second.title)
    expect(localizedRow?.slug).toBe(second.slug)
  })

  test("omits articles without a translation in the requested locale", async () => {
    const onlyEnglish = await seedArticle({ locale: "en" })

    const { data } = await api.api.articles.get({
      // SAFETY: omitted keys fall back to the server defaults; only the locale header matters here
      query: { page: 1, limit: 100 } as never,
      headers: { "x-locale": "id" }
    })

    expect(data?.data.some(row => row.id === onlyEnglish.article.id)).toBe(false)
  })

  test("resolves the stored cover key to a host URL and omits missing covers", async () => {
    const key = `articles/${faker.string.uuid({ version: 7 })}.png`
    const withCover = await seedArticle({ coverKey: key })
    const withoutCover = await seedArticle()

    const { data } = await list()

    const cover = data?.data.find(row => row.id === withCover.article.id)?.cover ?? ""
    expect(cover).toMatch(/^https?:\/\//)
    expect(cover.endsWith(`/${key}`)).toBe(true)
    expect(data?.data.find(row => row.id === withoutCover.article.id)?.cover).toBeUndefined()
  })

  test("rewrites NodeImage src keys in content to host URLs", async () => {
    const key = `articles/${faker.string.uuid({ version: 7 })}.jpg`
    const seeded = await seedArticle({
      content: { type: "doc", content: [{ type: "image", attrs: { src: key } }] }
    })

    const { data } = await list()

    const content = data?.data.find(row => row.id === seeded.article.id)?.content
    // SAFETY: shape mirrors the literal seeded above through the same JSON round-trip
    const image = (content as { content: { attrs: { src: string } }[] }).content[0]
    if (!image) throw new Error("missing seeded image node")
    expect(image.attrs.src).toMatch(/^https?:\/\//)
    expect(image.attrs.src.endsWith(`/${key}`)).toBe(true)
  })

  test("paginates with limit and offset", async () => {
    await seedArticle()
    await seedArticle()
    const third = await seedArticle()

    const firstPage = await list({ limit: 2 })
    expect(firstPage.data?.data).toHaveLength(2)

    const lastSeen = firstPage.data?.data.map(row => row.id) ?? []
    const secondPage = await list({ page: 2, limit: 2 })
    const secondIds = secondPage.data?.data.map(row => row.id) ?? []
    for (const id of secondIds) {
      expect(lastSeen).not.toContain(id)
    }
    expect([...lastSeen, ...secondIds]).toContain(third.article.id)
  })

  test("rejects an unknown status with 422", async () => {
    const { error, status } = await api.api.articles.get({
      // SAFETY: probing an out-of-enum status through the public HTTP surface
      query: { page: 1, limit: 20, status: "unknown" } as never
    })

    expect(status).toBe(422)
    expect(error).not.toBeNull()
    // SAFETY: error is a ValidationError per previous expect
    const payload = (error as EdenValidationError).value
    expect(payload).toMatchObject({ type: "validation", on: "query", property: "status" })
  })
})

function getArticle(identifier: string, headers?: Record<string, string>) {
  return api.api.articles({ identifier }).get(headers ? { headers } : undefined)
}

describe("GET /api/articles/:identifier", () => {
  test("returns 200 by id with translation fields and resolved image host URLs", async () => {
    const coverKey = `articles/${faker.string.uuid({ version: 7 })}.png`
    const imageKey = `articles/${faker.string.uuid({ version: 7 })}.jpg`
    const external = "https://cdn.example.org/pic.png"
    const seeded = await seedArticle({
      coverKey,
      content: {
        type: "doc",
        content: [
          { type: "image", attrs: { src: imageKey } },
          { type: "image", attrs: { src: external } }
        ]
      }
    })

    const { data, error, status, headers } = await getArticle(seeded.article.id)

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(new Headers(headers).get("content-language")).toBe("en")
    expect(data).toMatchObject({
      id: seeded.article.id,
      status: "published",
      title: seeded.translation.title,
      slug: seeded.translation.slug,
      excerpt: seeded.translation.excerpt,
      metaTitle: seeded.translation.metaTitle,
      metaDescription: seeded.translation.metaDescription
    })
    expect(data?.cover).toMatch(/^https?:\/\//)
    expect(data?.cover?.endsWith(`/${coverKey}`)).toBe(true)
    // SAFETY: shape mirrors the literal seeded above through the same JSON round-trip
    const content = data?.content as { content: { attrs: { src: string } }[] }
    expect(content.content[0]?.attrs.src).toMatch(/^https?:\/\//)
    expect(content.content[0]?.attrs.src.endsWith(`/${imageKey}`)).toBe(true)
    expect(content.content[1]?.attrs.src).toBe(external)
  })

  test("returns 200 by slug scoped to the requested locale", async () => {
    const seeded = await seedArticle({ locale: "id" })

    const result = await getArticle(seeded.translation.slug)
    expect(result.status).toBe(404)

    const localized = await getArticle(seeded.translation.slug, { "x-locale": "id" })

    expect(localized.error).toBeNull()
    expect(localized.status).toBe(200)
    expect(new Headers(localized.headers).get("content-language")).toBe("id")
    expect(localized.data?.id).toBe(seeded.article.id)
    expect(localized.data?.title).toBe(seeded.translation.title)
  })

  test("returns 404 for an unknown id and an unknown slug", async () => {
    await seedArticle()

    expect((await getArticle(faker.string.uuid({ version: 7 }))).status).toBe(404)
    expect((await getArticle(`nope-${faker.string.uuid({ version: 7 }).slice(0, 8)}`)).status).toBe(404)
  })

  test("returns 404 when the article has no translation in the requested locale, never another locale", async () => {
    const onlyEnglish = await seedArticle({ locale: "en" })

    expect((await getArticle(onlyEnglish.article.id, { "x-locale": "id" })).status).toBe(404)
    expect((await getArticle(onlyEnglish.translation.slug, { "x-locale": "id" })).status).toBe(404)
  })

  test("serves draft and archived articles to privileged viewers only", async () => {
    const admin = await createAuthSession("admin")
    const plain = await createAuthSession("")
    const draft = await seedArticle({ status: "draft" })
    const archived = await seedArticle({ status: "archived" })

    expect((await getArticle(draft.article.id)).status).toBe(404)
    expect((await getArticle(draft.translation.slug)).status).toBe(404)
    expect((await getArticle(archived.article.id)).status).toBe(404)
    expect((await getArticle(archived.translation.slug)).status).toBe(404)

    expect((await getArticle(draft.article.id, plain)).status).toBe(404)
    expect((await getArticle(archived.translation.slug, plain)).status).toBe(404)

    const draftByAdmin = await getArticle(draft.article.id, admin)
    expect(draftByAdmin.status).toBe(200)
    expect(draftByAdmin.data?.status).toBe("draft")

    const archivedBySlug = await getArticle(archived.translation.slug, admin)
    expect(archivedBySlug.status).toBe(200)
    expect(archivedBySlug.data?.id).toBe(archived.article.id)
  })

  test("treats an id-form identifier as an id even when another article uses it as a slug", async () => {
    const slugOwner = await seedArticle()
    const idOwner = await seedArticle({ locale: "id" })
    // SAFETY: raw insert bypasses the authoring-time rule that slugs must not look like ids
    await database.insert(articleTranslations).values({
      articleId: slugOwner.article.id,
      locale: "id",
      title: faker.lorem.words(3),
      slug: idOwner.article.id,
      excerpt: faker.lorem.sentence(),
      content: VALID_DOC,
      metaTitle: faker.lorem.words(2),
      metaDescription: faker.lorem.sentence()
    })

    const { data, status } = await getArticle(idOwner.article.id, { "x-locale": "id" })

    expect(status).toBe(200)
    expect(data?.id).toBe(idOwner.article.id)
  })

  test("rejects an identifier that slugifies to an empty string with 422", async () => {
    const { error, status } = await getArticle("!!!")

    expect(status).toBe(422)
    // SAFETY: error is a ValidationError per previous expect
    expect((error as EdenValidationError).value).toMatchObject({
      type: "validation",
      on: "params",
      property: "identifier"
    })
  })
})

// NOTE: the route reuses the production storage singleton, so these HTTP tests only
// cover gates and pre-upload validation. Full persistence behavior, including uploads,
// lives in the ArticleService unit tests with an in-memory storage double.
describe("POST /api/articles", () => {
  // Minimal valid PNG header: the boundary gate sniffs magic bytes, not the claimed MIME.
  const PNG_1X1 = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d,
    0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]

  function coverFile(): File {
    return new File([new Uint8Array(PNG_1X1)], "cover.png", { type: "image/png" })
  }

  function createPayload(
    overrides: Partial<z.input<typeof createArticleSchema>> = {}
  ): z.input<typeof createArticleSchema> {
    return {
      locale: "en",
      title: faker.lorem.words({ min: 2, max: 5 }),
      slug: `${faker.lorem.slug()}-${faker.string.uuid({ version: 7 }).slice(0, 8)}`,
      excerpt: faker.lorem.sentence(),
      content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
      metaTitle: faker.lorem.words({ min: 1, max: 3 }),
      metaDescription: faker.lorem.sentence(),
      cover: coverFile(),
      ...overrides
    }
  }

  function createArticle(payload: Partial<z.input<typeof createArticleSchema>>, headers?: Record<string, string>) {
    // SAFETY: treaty body type is the parsed output shape; multipart accepts File parts plus loose fields
    return api.api.articles.post(payload as never, headers ? { headers } : undefined)
  }

  async function translationSlugs(slug: string): Promise<string[]> {
    return (
      await database
        .select({ slug: articleTranslations.slug })
        .from(articleTranslations)
        .where(eq(articleTranslations.slug, slug))
    ).map(row => row.slug)
  }

  test("returns 401 without a session", async () => {
    const { error, status } = await createArticle(createPayload())

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("returns 403 for a verified non-admin session", async () => {
    const plain = await createAuthSession("")

    const { error, status } = await createArticle(createPayload(), plain)

    expect(status).toBe(403)
    expect(error).not.toBeNull()
  })

  test("lets admin and superadmin past the gate to validation", async () => {
    const admin = await createAuthSession("admin")
    const superadmin = await createAuthSession("superadmin")
    const { cover: _ignored, ...withoutCover } = createPayload()

    for (const headers of [admin, superadmin]) {
      const { error, status } = await createArticle(withoutCover, headers)

      expect(status).toBe(422)
      // SAFETY: error is a ValidationError per previous expect
      expect((error as EdenValidationError).value).toMatchObject({
        type: "validation",
        on: "body",
        property: "cover"
      })
    }
  })

  test("rejects content that is not a JSON string with 422", async () => {
    const headers = await createAuthSession("admin")
    const payload = createPayload({ content: "not json {" })
    const slug = payload["slug"]

    const { error, status } = await createArticle(payload, headers)

    expect(status).toBe(422)
    // SAFETY: error is a ValidationError per previous expect
    expect((error as EdenValidationError).value).toMatchObject({
      type: "validation",
      on: "body",
      property: "content"
    })
    expect(await translationSlugs(slug)).toEqual([])
  })

  test("rejects a placeholder without a matching file with 422", async () => {
    const headers = await createAuthSession("admin")
    const payload = createPayload({
      content: JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "upload://ghost" } }] })
    })
    const slug = payload["slug"]

    const { error, status } = await createArticle(payload, headers)

    expect(status).toBe(422)
    // SAFETY: error is a ValidationError per previous expect
    expect((error as EdenValidationError).value).toMatchObject({
      type: "validation",
      on: "body",
      errors: expect.arrayContaining([expect.objectContaining({ path: ["content"] })])
    })
    expect(await translationSlugs(slug)).toEqual([])
  })

  test("rejects a file without a matching placeholder with 422", async () => {
    const headers = await createAuthSession("admin")
    const payload = createPayload({ stray: coverFile() })
    const slug = payload["slug"]

    const { error, status } = await createArticle(payload, headers)

    expect(status).toBe(422)
    // SAFETY: error is a ValidationError per previous expect
    expect((error as EdenValidationError).value).toMatchObject({
      type: "validation",
      on: "body",
      errors: expect.arrayContaining([expect.objectContaining({ path: ["stray"] })])
    })
    expect(await translationSlugs(slug)).toEqual([])
  })

  test("rejects a non-image cover with 422", async () => {
    const headers = await createAuthSession("admin")
    const payload = createPayload({ cover: new File(["not an image"], "cover.png", { type: "image/png" }) })
    const slug = payload["slug"]

    const { error, status } = await createArticle(payload, headers)

    expect(status).toBe(422)
    // SAFETY: error is a ValidationError per previous expect
    expect((error as EdenValidationError).value).toMatchObject({
      type: "validation",
      on: "body",
      property: "cover"
    })
    expect(await translationSlugs(slug)).toEqual([])
  })
})
