import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"
import { ValidationError } from "elysia"

import { database } from "../../../common/database.js"
import { StorageKey } from "../../../common/storage/storage-key.js"
import type { FileMetadata, UploadFileParams } from "../../../common/storage/storage.js"
import type { CreateArticleBody } from "../schemas/article.schema.js"
import { articles, articleTranslations } from "../tables/article.table.js"
import { ArticleService } from "./article.service.js"

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

export function pngFile(name: string, size = 1024): File {
  return imageFile(name, PNG_1X1, "image/png", size)
}

export function jpegFile(name: string, size = 1024): File {
  return imageFile(name, JPEG_MINIMAL, "image/jpeg", size)
}

export class FakeStorage {
  public readonly objects = new Map<string, { size: number; contentType?: string | undefined }>()

  public async upload({ key, stream, headers }: UploadFileParams): Promise<FileMetadata> {
    let size = 0
    for await (const chunk of stream) {
      // SAFETY: storage upload streams deliver binary chunks; only the byte length is observed
      size += (chunk as Uint8Array).length
    }
    const keyString = key.toString()
    this.objects.set(keyString, { size, contentType: headers?.contentType })
    return { key: keyString, contentType: headers?.contentType, size }
  }

  public async delete(key: StorageKey): Promise<void> {
    this.objects.delete(key.toString())
  }
}

function createBody(overrides: Partial<CreateArticleBody> = {}): CreateArticleBody {
  return {
    locale: "en",
    title: faker.lorem.words({ min: 2, max: 5 }),
    slug: `${faker.lorem.slug()}-${faker.string.uuid({ version: 7 }).slice(0, 8)}`,
    excerpt: faker.lorem.sentence(),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    metaTitle: faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: faker.lorem.sentence(),
    cover: pngFile("cover.png"),
    ...overrides
  }
}

async function readStoredArticle(id: string) {
  const [article] = await database.select().from(articles).where(eq(articles.id, id)).limit(1)
  const [translation] = await database
    .select()
    .from(articleTranslations)
    .where(eq(articleTranslations.articleId, id))
    .limit(1)
  if (!article || !translation) throw new Error("article not persisted")
  return { article, translation }
}

async function countArticles(): Promise<number> {
  return (await database.select({ id: articles.id }).from(articles)).length
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

describe("ArticleService.create", () => {
  test("persists keys and serves urls for cover plus inline images", async () => {
    const storage = new FakeStorage()
    const service = new ArticleService(database, storage)
    const body = createBody({
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "hello" }] },
          { type: "image", attrs: { src: "upload://inline-1", alt: "inline" } }
        ]
      },
      "inline-1": jpegFile("inline-1")
    })

    const result = await service.create(body)

    expect(result.slug).toBe(body.slug)
    expect(result.title).toBe(body.title)
    expect(result.cover).toMatch(/^https?:\/\//)
    const stored = await readStoredArticle(result.id)
    expect(stored.article.coverKey).not.toBe("")
    expect(result.cover?.endsWith(`/${stored.article.coverKey}`)).toBe(true)
    expect(stored.article.coverKey.startsWith(`articles/${result.id}-`)).toBe(true)
    expect(JSON.stringify(stored.translation.content)).not.toContain("upload://")
    expect(JSON.stringify(stored.translation.content)).not.toContain("http")
    // SAFETY: shape mirrors the image-node literal seeded in the request body above
    const content = stored.translation.content as { content: { attrs: { src: string } }[] }
    // SAFETY: served content carries the same document shape with keys resolved to host URLs
    const served = result.content as { content: { attrs: { src: string } }[] }
    expect(served.content[1]?.attrs.src.endsWith(`/${content.content[1]?.attrs.src}`)).toBe(true)
    expect(content.content[1]?.attrs.src.startsWith(`articles/${result.id}-`)).toBe(true)
    expect(content.content[1]?.attrs.src.endsWith(".jpg")).toBe(true)
    expect(storage.objects.size).toBe(2)
  })

  test("rejects a placeholder without a matching file, persisting nothing", async () => {
    const storage = new FakeStorage()
    const service = new ArticleService(database, storage)
    const before = await countArticles()
    const body = createBody({
      content: { type: "doc", content: [{ type: "image", attrs: { src: "upload://ghost" } }] }
    })

    const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

    expect(payload.errors).toEqual([
      expect.objectContaining({ path: ["content"], message: expect.stringContaining("ghost") })
    ])
    expect(await countArticles()).toBe(before)
    expect(storage.objects.size).toBe(0)
  })

  test("rejects a file without a matching placeholder, persisting nothing", async () => {
    const storage = new FakeStorage()
    const service = new ArticleService(database, storage)
    const before = await countArticles()
    const body = createBody({ stray: pngFile("stray.png") })

    const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

    expect(payload.errors).toEqual([
      expect.objectContaining({ path: ["stray"], message: expect.stringContaining("stray") })
    ])
    expect(await countArticles()).toBe(before)
    expect(storage.objects.size).toBe(0)
  })

  test("rejects a non-image upload, persisting nothing", async () => {
    const storage = new FakeStorage()
    const service = new ArticleService(database, storage)
    const before = await countArticles()
    const body = createBody({ cover: new File(["not an image"], "cover.png", { type: "image/png" }) })

    const payload = validationPayload(await service.create(body).catch((error: unknown) => error))

    expect(payload.errors).toEqual([expect.objectContaining({ path: ["cover"] })])
    expect(await countArticles()).toBe(before)
    expect(storage.objects.size).toBe(0)
  })

  test("surfaces a per-locale slug collision as a field-level conflict", async () => {
    const storage = new FakeStorage()
    const service = new ArticleService(database, storage)
    const first = await service.create(createBody())
    const before = await countArticles()

    const payload = validationPayload(
      await service.create(createBody({ slug: first.slug })).catch((error: unknown) => error)
    )

    expect(payload.errors).toEqual([expect.objectContaining({ path: ["slug"], message: "Slug already exists" })])
    expect(await countArticles()).toBe(before)
    // The colliding cover upload is compensated, leaving only the first article's cover
    expect(storage.objects.size).toBe(1)
  })

  test("rejects an unknown category id without leaking a server error", async () => {
    const storage = new FakeStorage()
    const service = new ArticleService(database, storage)
    const before = await countArticles()

    const payload = validationPayload(
      await service
        .create(createBody({ categoryId: faker.string.uuid({ version: 7 }) }))
        .catch((error: unknown) => error)
    )

    expect(payload.errors).toEqual([expect.objectContaining({ path: ["categoryId"] })])
    expect(await countArticles()).toBe(before)
    expect(storage.objects.size).toBe(0)
  })
})
