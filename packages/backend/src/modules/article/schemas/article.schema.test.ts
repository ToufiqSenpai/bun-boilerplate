import { COMMON_IMAGE_MIMETYPE } from "@bun-boilerplate/constants"
import type { RichText } from "@bun-boilerplate/richtext"
import { faker } from "@faker-js/faker"

import {
  createArticleSchema,
  deleteArticleParamsSchema,
  updateArticleResponseSchema,
  updateArticleSchema,
  upsertArticleTranslationSchema
} from "./article.schema.js"

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
const WEBP_MINIMAL = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]
const AVIF_MINIMAL = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]
const GIF_MINIMAL = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00]

const MAGIC_BY_MIME = {
  "image/png": { magic: PNG_1X1, type: "image/png" },
  "image/jpeg": { magic: JPEG_MINIMAL, type: "image/jpeg" },
  "image/avif": { magic: AVIF_MINIMAL, type: "image/avif" },
  "image/webp": { magic: WEBP_MINIMAL, type: "image/webp" }
}

const COVER_MIME_MESSAGE = `Cover image mimetype must be ${COMMON_IMAGE_MIMETYPE.join(", ")}.`

function imageFile(name: string, magic: number[], type: string, size = 1024): File {
  const body = new Uint8Array(Math.max(size, magic.length))
  body.set(magic)
  return new File([body], name, { type })
}

type PayloadValue = string | File | RichText | null
type Payload = Record<string, PayloadValue>

export function pngFile(name: string, size: number): File {
  return imageFile(name, PNG_1X1, "image/png", size)
}

function createInput(overrides: Payload = {}) {
  return {
    categoryId: null,
    locale: faker.helpers.arrayElement(["en", "id"] as const),
    title: faker.lorem.words({ min: 2, max: 5 }),
    slug: faker.lorem.slug(),
    excerpt: faker.lorem.sentence(),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    metaTitle: faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: faker.lorem.sentence(),
    cover: pngFile("cover.png", 1024),
    ...overrides
  }
}

async function parseIssues(input: Payload) {
  const result = await createArticleSchema.safeParseAsync(input)
  if (result.success) expect.unreachable("expected validation to fail")
  return result.error.issues
}

describe("createArticleSchema", () => {
  test("parses a valid multipart payload, keeping dynamic file parts", async () => {
    const inline = pngFile("inline-1", 512)
    const result = await createArticleSchema.safeParseAsync(createInput({ "inline-1": inline }))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
    expect(result.data.cover.file).toBeInstanceOf(File)
    expect(result.data.cover.mime).toBe("image/png")
    expect(result.data["inline-1"]?.file).toBe(inline)
  })

  test("slugifies the provided slug", async () => {
    const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()
    const result = await createArticleSchema.safeParseAsync(createInput({ slug: rawSlug }))

    expect(result.success).toBe(true)
  })

  test("rejects a missing cover", async () => {
    const { cover: _ignored, ...withoutCover } = createInput()
    void _ignored

    expect(await parseIssues(withoutCover)).toEqual([expect.objectContaining({ path: ["cover"] })])
  })

  test("rejects an undetectable cover file", async () => {
    const cover = new File(["not an image"], "cover.png", { type: "text/plain" })

    expect(await parseIssues(createInput({ cover }))).toEqual([
      expect.objectContaining({ path: ["cover"], message: "File type could not be detected" })
    ])
  })

  test("rejects a detectable but disallowed cover mime", async () => {
    const cover = imageFile("cover.gif", GIF_MINIMAL, "image/gif")

    expect(await parseIssues(createInput({ cover }))).toEqual([
      expect.objectContaining({ path: ["cover"], message: COVER_MIME_MESSAGE })
    ])
  })

  test("accepts the allowlisted image mimes", async () => {
    expect(Object.keys(MAGIC_BY_MIME).sort()).toEqual([...COMMON_IMAGE_MIMETYPE].sort())
    for (const { magic, type } of Object.values(MAGIC_BY_MIME)) {
      const result = await createArticleSchema.safeParseAsync(createInput({ cover: imageFile("cover", magic, type) }))

      expect(result.success).toBe(true)
    }
  })

  test("rejects an undetectable inline file part", async () => {
    const part = new File(["not an image"], "inline-1", { type: "text/plain" })

    expect(await parseIssues(createInput({ "inline-1": part }))).toEqual([
      expect.objectContaining({ path: ["inline-1"], message: "File type could not be detected" })
    ])
  })

  test("rejects a detectable but disallowed inline file part", async () => {
    const part = imageFile("inline-1", GIF_MINIMAL, "image/gif")

    expect(await parseIssues(createInput({ "inline-1": part }))).toEqual([
      expect.objectContaining({ path: ["inline-1"], message: COVER_MIME_MESSAGE })
    ])
  })

  test("rejects content that is not a JSON string", async () => {
    expect(await parseIssues(createInput({ content: "not json {" }))).toEqual([
      expect.objectContaining({ path: ["content"] })
    ])
  })

  test("accepts a pre-parsed content object as delivered by multipart parsing", async () => {
    const result = await createArticleSchema.safeParseAsync(
      createInput({ content: { type: "doc", content: [{ type: "paragraph" }] } })
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
  })

  test("rejects content with an invalid rich text envelope", async () => {
    expect(await parseIssues(createInput({ content: { type: "nope" } }))).toEqual([
      expect.objectContaining({ path: ["content"] })
    ])
  })

  test("rejects an empty slug", async () => {
    expect(await parseIssues(createInput({ slug: "" }))).toEqual([
      expect.objectContaining({ path: ["slug"], message: "Slug must not be empty" })
    ])
  })

  test("rejects a slug that looks like an article id", async () => {
    expect(await parseIssues(createInput({ slug: faker.string.uuid({ version: 7 }) }))).toEqual([
      expect.objectContaining({ path: ["slug"], message: "Slug must not look like a uuid" })
    ])
  })

  test("rejects a non-uuid category id", async () => {
    expect(await parseIssues(createInput({ categoryId: "not-an-id" }))).toEqual([
      expect.objectContaining({ path: ["categoryId"] })
    ])
  })
})

function upsertInput(overrides: Payload = {}) {
  return {
    title: faker.lorem.words({ min: 2, max: 5 }),
    slug: faker.lorem.slug(),
    excerpt: faker.lorem.sentence(),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    metaTitle: faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: faker.lorem.sentence(),
    ...overrides
  }
}

async function parseUpsertIssues(input: Payload) {
  const result = await upsertArticleTranslationSchema.safeParseAsync(input)
  if (result.success) expect.unreachable("expected validation to fail")
  return result.error.issues
}

async function parseUpdateIssues(input: Payload) {
  const result = await updateArticleSchema.safeParseAsync(input)
  if (result.success) expect.unreachable("expected validation to fail")
  return result.error.issues
}

describe("upsertArticleTranslationSchema", () => {
  test("parses a valid multipart payload, keeping dynamic file parts", async () => {
    const inline = pngFile("inline-1", 512)
    const result = await upsertArticleTranslationSchema.safeParseAsync(upsertInput({ "inline-1": inline }))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
    expect(result.data["inline-1"]?.file).toBe(inline)
  })

  test("accepts content as a JSON string", async () => {
    const content = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })
    const result = await upsertArticleTranslationSchema.safeParseAsync(upsertInput({ content }))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
  })

  test("rejects an empty title", async () => {
    expect(await parseUpsertIssues(upsertInput({ title: "" }))).toEqual([expect.objectContaining({ path: ["title"] })])
  })

  test("rejects content with an invalid rich text envelope", async () => {
    expect(await parseUpsertIssues(upsertInput({ content: { type: "nope" } }))).toEqual([
      expect.objectContaining({ path: ["content"] })
    ])
  })

  test("rejects a detectable but disallowed inline file part", async () => {
    const part = imageFile("inline-1", GIF_MINIMAL, "image/gif")

    expect(await parseUpsertIssues(upsertInput({ "inline-1": part }))).toEqual([
      expect.objectContaining({ path: ["inline-1"], message: COVER_MIME_MESSAGE })
    ])
  })
})

describe("updateArticleSchema", () => {
  test("parses a status-only patch", async () => {
    const result = await updateArticleSchema.safeParseAsync({ status: "published" })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe("published")
  })

  test("leaves absent fields out so a partial patch never resets them", async () => {
    const result = await updateArticleSchema.safeParseAsync({})

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({})
  })

  test("parses a category-only patch, accepting null to unassign", async () => {
    const categoryId = faker.string.uuid({ version: 7 })
    const assigned = await updateArticleSchema.safeParseAsync({ categoryId })
    const unassigned = await updateArticleSchema.safeParseAsync({ categoryId: null })

    expect(assigned.success && assigned.data.categoryId).toBe(categoryId)
    expect(unassigned.success && unassigned.data.categoryId).toBeNull()
  })

  test("parses a cover-only patch, sniffing the image mime", async () => {
    const cover = pngFile("cover.png", 1024)
    const result = await updateArticleSchema.safeParseAsync({ cover })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.cover?.file).toBe(cover)
    expect(result.data.cover?.mime).toBe("image/png")
  })

  test("rejects translation fields as unrecognized keys", async () => {
    for (const field of ["locale", "title", "slug", "excerpt", "content", "metaTitle", "metaDescription"]) {
      const issues = await parseUpdateIssues({ [field]: "value" })

      expect(issues).toEqual([expect.objectContaining({ code: "unrecognized_keys", keys: [field] })])
    }
  })

  test("rejects a stray inline file part", async () => {
    const inline = pngFile("inline-1", 512)

    expect(await parseUpdateIssues({ "inline-1": inline })).toEqual([
      expect.objectContaining({ code: "unrecognized_keys", keys: ["inline-1"] })
    ])
  })

  test("rejects an invalid status", async () => {
    expect(await parseUpdateIssues({ status: "deleted" })).toEqual([expect.objectContaining({ path: ["status"] })])
  })

  test("rejects a non-uuid category id", async () => {
    expect(await parseUpdateIssues({ categoryId: "not-an-id" })).toEqual([
      expect.objectContaining({ path: ["categoryId"] })
    ])
  })

  test("rejects a detectable but disallowed cover mime", async () => {
    const cover = imageFile("cover.gif", GIF_MINIMAL, "image/gif")

    expect(await parseUpdateIssues({ cover })).toEqual([
      expect.objectContaining({ path: ["cover"], message: COVER_MIME_MESSAGE })
    ])
  })

  test("rejects an undetectable cover file", async () => {
    const cover = new File(["not an image"], "cover.png", { type: "text/plain" })

    expect(await parseUpdateIssues({ cover })).toEqual([
      expect.objectContaining({ path: ["cover"], message: "File type could not be detected" })
    ])
  })

  test("exposes only article-level fields in the response schema", () => {
    expect(Object.keys(updateArticleResponseSchema.shape).sort()).toEqual(
      ["categoryId", "cover", "createdAt", "id", "publishedAt", "status", "updatedAt"].sort()
    )
  })
})

describe("deleteArticleParamsSchema", () => {
  test("accepts a uuidv7 article id", () => {
    const id = faker.string.uuid({ version: 7 })
    const result = deleteArticleParamsSchema.safeParse({ id })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.id).toBe(id)
  })

  test.each(["not-an-id", faker.string.uuid({ version: 4 }), faker.lorem.slug()])(
    "rejects the non-uuidv7 identifier %s",
    id => {
      const result = deleteArticleParamsSchema.safeParse({ id })

      expect(result.success).toBe(false)
    }
  )
})
